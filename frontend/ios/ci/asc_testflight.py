#!/usr/bin/env python3
"""After an upload: waits for App Store Connect to process the build, then gives it to the internal testers,
so it reaches their TestFlight app without anyone adding it by hand.

  asc_testflight.py BUILD_NUMBER   waits (up to 30 minutes) until the build is processed, fails if Apple
                                   finds it invalid, then adds it to every internal TestFlight group

Same environment as asc_signing.py (ASC_KEY_ID, ASC_ISSUER_ID, APP_ID and the API key).
"""

import os
import sys
import time

from asc_signing import call

WAIT = 30 * 60


def main(number: str) -> None:
    app_id = os.environ["APP_ID"]
    app = next(
        a for a in call("GET", f"/apps?filter[bundleId]={app_id}")["data"] if a["attributes"]["bundleId"] == app_id
    )
    deadline = time.time() + WAIT
    build = None
    while time.time() < deadline:
        found = call("GET", f"/builds?filter[app]={app['id']}&filter[version]={number}&limit=1")["data"]
        if found:
            build = found[0]
            state = build["attributes"]["processingState"]
            print(f"build {number}: {state}", flush=True)
            if state == "VALID":
                break
            if state in ("INVALID", "FAILED"):
                sys.exit(
                    f"::error::App Store Connect couldn't process build {number} ({state}); Apple e-mails the reason"
                )
        else:
            print(f"build {number}: not in App Store Connect yet", flush=True)
        time.sleep(30)
    else:
        print(
            f"::warning::build {number} was still processing after {WAIT // 60} minutes; it reaches TestFlight once done"
        )
        return
    for group in call("GET", f"/apps/{app['id']}/betaGroups?limit=50")["data"]:
        attributes = group["attributes"]
        if not attributes.get("isInternalGroup"):
            continue
        if attributes.get("hasAccessToAllBuilds"):
            # automatic distribution: App Store Connect refuses to add builds to such a group by hand
            print(f"the internal group {attributes['name']!r} gets every build by itself")
            continue
        body = {"data": [{"type": "builds", "id": build["id"]}]}
        if call("POST", f"/betaGroups/{group['id']}/relationships/builds", body, check=False) is not None:
            print(f"added to the internal group {attributes['name']!r}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
