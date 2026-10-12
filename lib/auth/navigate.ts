/** Thin seam over window.location navigation so flows that end in a full page navigation can be tested. */
export function goTo(url: string): void {
  window.location.href = url;
}

export function replaceWith(url: string): void {
  window.location.replace(url);
}
