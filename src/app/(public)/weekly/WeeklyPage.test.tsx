import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WeeklyPage from "./page";
import { createEmptyWeeklyInput } from "@/lib/validation";
import type { Weekly } from "@/types/notice";

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/bulletin-master", () => ({
  loadBulletinMaster: vi.fn(async () => null),
}));
vi.mock("@/components/bulletin/Bulletin", () => ({
  default: ({ weekly }: { weekly: Weekly }) => (
    <div data-testid="paper-bulletin">{weekly.title}</div>
  ),
}));

const latest: Weekly = {
  ...createEmptyWeeklyInput(),
  id: "latest",
  title: "최신 종이 주보",
  date: "2026-07-26",
  created_at: "2026-07-20T00:00:00Z",
};
const archived: Weekly = {
  ...latest,
  id: "archived",
  title: "지난 종이 주보",
  date: "2026-07-19",
};

describe("WeeklyPage", () => {
  beforeEach(() => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => ({ data: [latest, archived] })),
    };
    createClientMock.mockResolvedValue({ from: vi.fn(() => query) });
  });

  it("keeps the paper bulletin and archive while adding the mobile entry link", async () => {
    render(await WeeklyPage());
    expect(screen.getByTestId("paper-bulletin")).toHaveTextContent("최신 종이 주보");
    expect(screen.getByRole("link", { name: /지난 종이 주보/ })).toHaveAttribute(
      "href",
      "/weekly/archived",
    );
    expect(screen.getByRole("link", { name: "모바일 주보 보기" })).toHaveAttribute(
      "href",
      "/weekly/mobile",
    );
  });
});
