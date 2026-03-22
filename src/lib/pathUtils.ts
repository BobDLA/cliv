export interface PathInfo {
  baseName: string;
  parentPath: string | null;
}

interface WorkspacePathInput {
  workspacePath?: string | null;
  reviewPath?: string | null;
  replyPath?: string | null;
  targetPath?: string | null;
}

export function getPathInfo(path: string): PathInfo {
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));

  if (lastSlash < 0) {
    return {
      baseName: path,
      parentPath: null,
    };
  }

  const baseName = path.slice(lastSlash + 1) || path;

  if (lastSlash === 0) {
    return {
      baseName,
      parentPath: path[0] === "/" ? "/" : null,
    };
  }

  const hasWindowsDriveRoot =
    lastSlash === 2 && /^[A-Za-z]:[\\/]/.test(path);

  return {
    baseName,
    parentPath: hasWindowsDriveRoot ? path.slice(0, lastSlash + 1) : path.slice(0, lastSlash),
  };
}

function isAbsolutePath(path: string | null | undefined): path is string {
  if (!path) return false;
  return path.startsWith("/") || /^[A-Za-z]:[\\/]/.test(path);
}

function getAbsoluteParentPath(path: string | null | undefined): string | null {
  if (!isAbsolutePath(path)) return null;
  return getPathInfo(path).parentPath;
}

export function resolveWorkspacePath({
  workspacePath,
  reviewPath,
  replyPath,
  targetPath,
}: WorkspacePathInput): string | null {
  const replyParent = getAbsoluteParentPath(replyPath);
  const reviewParent = getAbsoluteParentPath(reviewPath);
  const targetParent = getAbsoluteParentPath(targetPath);

  if (!targetPath) {
    return replyParent ?? reviewParent ?? workspacePath ?? targetParent ?? null;
  }

  return workspacePath ?? targetParent ?? replyParent ?? reviewParent ?? null;
}
