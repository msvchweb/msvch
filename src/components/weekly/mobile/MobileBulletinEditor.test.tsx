import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileBulletinEditor } from "./MobileBulletinEditor";
import { createEmptyWeeklyInput } from "@/lib/validation";
import type { MobileService } from "@/types/mobile-bulletin";

const weekly = {
  ...createEmptyWeeklyInput(),
  title: "테스트 주보",
  date: "2026-07-26",
  worship_items: [{ marker: "", label: "찬송", content: "21장", assignees: [], subRows: [], emphasize: false }],
  wednesday_service: { leader: "인도자", scripture: "요한복음 3:16", title: "하나님의 사랑", pastor: "담임목사", hymn: "310장", benediction: "담임목사" },
};

const services: MobileService[] = [{
  id: "sun", type: "sunday", label: "주일예배", startsAt: "2026-07-26T08:00:00+09:00", endsAt: "2026-07-26T13:30:00+09:00", primary: true, visible: true, leader: "", liveUrl: null, videoId: null,
  items: [
    { id: "hymn", label: "찬송", summary: "21장", assignees: [], emphasized: false, standing: false, visible: true, resourceId: null, externalUrl: null },
    { id: "offering", label: "봉헌", summary: "", assignees: [], emphasized: false, standing: false, visible: true, resourceId: null, externalUrl: null },
  ],
}];

afterEach(cleanup);

describe("MobileBulletinEditor", () => {
  it("generates Sunday and Wednesday services from the existing weekly input", () => {
    const onChange = vi.fn();
    render(<MobileBulletinEditor value={[]} weekly={weekly} resources={[]} videos={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "기존 주보 내용으로 생성" }));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ type: "sunday" }),
      expect.objectContaining({ type: "wednesday" }),
    ]));
  });

  it("adds a Friday service", () => {
    const onChange = vi.fn();
    render(<MobileBulletinEditor value={[]} weekly={weekly} resources={[]} videos={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "금요기도회 추가" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.arrayContaining([expect.objectContaining({ type: "friday" })]));
  });

  it("moves an order item up", () => {
    const onChange = vi.fn();
    render(<MobileBulletinEditor value={services} weekly={weekly} resources={[]} videos={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "봉헌 위로" }));
    const next = onChange.mock.calls.at(-1)?.[0] as MobileService[];
    expect(next[0].items.map((item) => item.id)).toEqual(["offering", "hymn"]);
  });
});
