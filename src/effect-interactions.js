// Keep the button mounted: replacing it after the first click breaks double-clicks.
export function bindEffectInteractions(
  button,
  { select, toggle, activation = () => 'double' },
) {
  let previousTouch = null,
    lastTouch = 0;
  button.addEventListener('click', () => {
    select();
    if (activation() === 'single') toggle();
  });
  button.addEventListener('dblclick', (event) => {
    if (activation() === 'single') return;
    if (lastTouch && event.timeStamp - lastTouch < 700) return; // Touch already toggled on pointerup.
    toggle();
  });
  button.addEventListener('pointerup', (event) => {
    if (event.pointerType !== 'touch') return;
    if (activation() === 'single') {
      previousTouch = null;
      return;
    }
    lastTouch = event.timeStamp;
    if (previousTouch !== null && event.timeStamp - previousTouch <= 350) {
      previousTouch = null;
      toggle();
    } else previousTouch = event.timeStamp;
  });
  button.addEventListener('pointercancel', () => (previousTouch = null));
}
