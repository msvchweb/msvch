import "@testing-library/jest-dom/vitest";

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
// jsdom 은 레이아웃이 없어 scrollIntoView 를 아예 정의하지 않는다.
// 스크롤을 호출하는 컴포넌트가 테스트에서 TypeError 로 죽지 않도록 무동작으로 채운다.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
