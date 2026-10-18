/* No logs or user records are sent to the monitoring service. */
require("./backup-automation.cjs")
  .heartbeat(process.env.HEALTHCHECKS_PING_URL, "fail")
  .catch(() => {
    console.error(
      "Failure notification unavailable; check Healthchecks for a missing run.",
    );
    process.exitCode = 1;
  });
