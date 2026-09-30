export const COUNTER_URL='https://api.counterapi.dev/v2/tonex-one-studio-counter/tonex-one-studio-visits';
const SESSION_KEY='tonex-visit-attempt:'+COUNTER_URL;

export function isCounterSite(location) {
  return location.origin==='https://yvr-vibe.github.io'&&location.pathname.startsWith('/tonex-one-studio/');
}

// Reserve the session before sending: an interrupted response may still have counted.
// Never retry increments automatically or guess a total from buffered responses.
export async function showVisitCounter(element,{fetchImpl=globalThis.fetch,storage,timeoutMs=8000}={}) {
  if(!element)return;
  element.hidden=true;
  let increment=true;
  try {
    increment=storage?.getItem(SESSION_KEY)!=='1';
    storage?.setItem(SESSION_KEY,'1');
  } catch { /* Storage restrictions leave counting at once per page load. */ }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const url=new URL(COUNTER_URL+(increment?'/up':''));
    // The service sends a long cache lifetime, including for increment requests.
    url.searchParams.set('_',String(Date.now()));
    const response=await fetchImpl(url.href,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
    if(!response.ok)throw new Error('Counter unavailable');
    const {data}=await response.json();
    if(!Number.isSafeInteger(data?.up_count)||!Number.isSafeInteger(data?.down_count))throw new Error('Invalid counter');
    const count=data.up_count-data.down_count;
    if(!Number.isSafeInteger(count)||count<0)throw new Error('Invalid total');
    element.textContent=`Visits: ${count.toLocaleString()}`;
    element.hidden=false;
  } catch { /* Optional service failures must not affect USB editing. */ }
  finally {clearTimeout(timer);}
}
