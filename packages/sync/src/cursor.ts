export type CursorState = {
  scopeId: string;
  cursor: string | null;
};

export type ChangeEnvelope = {
  changeId: string;
  aggregateType: string;
  aggregateId: string;
  revision: number;
  payload: Record<string, unknown>;
};

export type IncrementalPage = {
  kind: "incremental";
  scopeId: string;
  fromCursor: string | null;
  nextCursor: string;
  changes: ChangeEnvelope[];
};

export type SnapshotManifest = {
  kind: "snapshot_manifest";
  snapshotId: string;
  scopeId: string;
  cutCursor: string;
  pageCount: number;
  expiresAt: string;
  manifestHash: string;
};

export type SnapshotPage = {
  kind: "snapshot_page";
  snapshotId: string;
  scopeId: string;
  cutCursor: string;
  pageNumber: number;
  pageCount: number;
  integrityVerified: boolean;
  records: ChangeEnvelope[];
};

export type SnapshotAssemblerOptions = {
  verifyManifest: (manifest: SnapshotManifest) => boolean;
  now?: () => string;
};

export class CursorInvariantError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CursorInvariantError";
  }
}

export function applyIncrementalPage(
  current: CursorState,
  page: IncrementalPage,
): { nextState: CursorState; changes: ChangeEnvelope[] } {
  if (page.scopeId !== current.scopeId) {
    throw new CursorInvariantError("incremental page belongs to another scope");
  }
  if (page.fromCursor !== current.cursor) {
    throw new CursorInvariantError("incremental page starts from an unexpected cursor");
  }
  if (page.nextCursor.length === 0) {
    throw new CursorInvariantError("incremental page has an empty next cursor");
  }
  return {
    nextState: { scopeId: current.scopeId, cursor: page.nextCursor },
    changes: page.changes.map(cloneChange),
  };
}

export class SnapshotAssembler {
  private readonly pages = new Map<number, SnapshotPage>();

  public constructor(
    private readonly manifest: SnapshotManifest,
    options: SnapshotAssemblerOptions,
  ) {
    if (manifest.pageCount <= 0 || !Number.isInteger(manifest.pageCount)) {
      throw new CursorInvariantError("snapshot manifest has an invalid page count");
    }
    if (manifest.snapshotId.length === 0 || manifest.cutCursor.length === 0) {
      throw new CursorInvariantError("snapshot manifest is incomplete");
    }
    if (!options.verifyManifest(manifest)) {
      throw new CursorInvariantError("snapshot manifest integrity is not verified");
    }
    this.now = options.now ?? (() => new Date().toISOString());
  }

  private readonly now: () => string;

  addPage(page: SnapshotPage): void {
    if (page.snapshotId !== this.manifest.snapshotId) {
      throw new CursorInvariantError("snapshot page belongs to another snapshot");
    }
    if (page.scopeId !== this.manifest.scopeId) {
      throw new CursorInvariantError("snapshot page belongs to another scope");
    }
    if (page.cutCursor !== this.manifest.cutCursor) {
      throw new CursorInvariantError("snapshot page belongs to another cut");
    }
    if (page.pageCount !== this.manifest.pageCount) {
      throw new CursorInvariantError("snapshot page count does not match manifest");
    }
    if (
      !Number.isInteger(page.pageNumber) ||
      page.pageNumber < 0 ||
      page.pageNumber >= this.manifest.pageCount
    ) {
      throw new CursorInvariantError("snapshot page number is invalid");
    }
    if (!page.integrityVerified) {
      throw new CursorInvariantError("snapshot page integrity is not verified");
    }

    const existing = this.pages.get(page.pageNumber);
    if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(page)) {
      throw new CursorInvariantError("snapshot page was changed after persistence");
    }
    this.pages.set(page.pageNumber, clonePage(page));
  }

  isComplete(): boolean {
    return this.pages.size === this.manifest.pageCount;
  }

  activate(): { nextState: CursorState; records: ChangeEnvelope[] } {
    if (Date.parse(this.manifest.expiresAt) <= Date.parse(this.now())) {
      throw new CursorInvariantError("snapshot has expired");
    }
    if (!this.isComplete()) {
      throw new CursorInvariantError("snapshot is incomplete");
    }

    const records = [...this.pages.entries()]
      .sort(([pageA], [pageB]) => pageA - pageB)
      .flatMap(([, page]) => page.records.map(cloneChange));
    return {
      nextState: {
        scopeId: this.manifest.scopeId,
        cursor: this.manifest.cutCursor,
      },
      records,
    };
  }
}

function cloneChange(change: ChangeEnvelope): ChangeEnvelope {
  return { ...change, payload: { ...change.payload } };
}

function clonePage(page: SnapshotPage): SnapshotPage {
  return { ...page, records: page.records.map(cloneChange) };
}
