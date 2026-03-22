import { describe, expect, it } from "vitest";
import { getPathInfo, resolveWorkspacePath } from "@/lib/pathUtils";

describe("getPathInfo", () => {
  it("extracts basename and parent path from POSIX paths", () => {
    expect(getPathInfo("/tmp/project/reply.md")).toEqual({
      baseName: "reply.md",
      parentPath: "/tmp/project",
    });
  });

  it("extracts basename and parent path from Windows paths", () => {
    expect(getPathInfo("C:\\work\\project\\reply.md")).toEqual({
      baseName: "reply.md",
      parentPath: "C:\\work\\project",
    });
  });

  it("prefers the standalone file parent over the launch workspace", () => {
    expect(
      resolveWorkspacePath({
        workspacePath: "/tmp/current-launch",
        reviewPath: "/tmp/other-project/reply.md",
        replyPath: "/tmp/other-project/reply.md",
        targetPath: null,
      }),
    ).toBe("/tmp/other-project");
  });

  it("keeps the launch workspace for compose-target flows", () => {
    expect(
      resolveWorkspacePath({
        workspacePath: "/tmp/current-launch",
        reviewPath: "/tmp/other-project/reply.md",
        replyPath: "/tmp/other-project/reply.md",
        targetPath: "/tmp/current-launch/compose.md",
      }),
    ).toBe("/tmp/current-launch");
  });
});
