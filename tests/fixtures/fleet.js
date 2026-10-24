// TEST ONLY. Injected by Playwright; production code never imports this module.
export async function subscribeFleet(callbacks) {
  window.testFleet = callbacks;
  callbacks.onOffset(0);
  callbacks.onConnection(true);
  callbacks.onBuses({});
  return () => {
    delete window.testFleet;
  };
}
