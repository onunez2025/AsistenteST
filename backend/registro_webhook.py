#!/usr/bin/env python3
"""
CLI para gestionar la suscripcion de webhook de Qualtrics.

Uso:
  python registro_webhook.py --register <URL_PUBLICA_BACKEND>
  python registro_webhook.py --list
  python registro_webhook.py --delete <subscriptionId>
  python registro_webhook.py --test <responseId>
  python registro_webhook.py --test <responseId> <url_local>
"""
import sys
import os
import json
import requests
from dotenv import load_dotenv

load_dotenv()

BASE    = os.getenv("QUALTRICS_BASE_URL", "").rstrip("/")
TOKEN   = os.getenv("QUALTRICS_API_TOKEN", "")
SURVEY  = os.getenv("QUALTRICS_SURVEY_ST", "")
SECRET  = os.getenv("QUALTRICS_WEBHOOK_SECRET", "")
HEADERS = {"X-API-TOKEN": TOKEN, "Content-Type": "application/json"}


def register(public_url: str) -> None:
    webhook_url = f"{public_url.rstrip('/')}/webhook/qualtrics?secret={SECRET}"
    payload = {
        "topics":                f"surveyengine.completedResponse.{SURVEY}",
        "publicationUrl":        webhook_url,
        "encrypt":               False,
        "successEmailAddresses": [],
    }
    r = requests.post(f"{BASE}/API/v3/eventsubscriptions", headers=HEADERS, json=payload, timeout=15)
    print(f"HTTP {r.status_code}")
    print(json.dumps(r.json(), indent=2, ensure_ascii=False))


def list_subs() -> None:
    r = requests.get(f"{BASE}/API/v3/eventsubscriptions", headers=HEADERS, timeout=15)
    print(f"HTTP {r.status_code}")
    elements = r.json().get("result", {}).get("elements", [])
    if not elements:
        print("Sin suscripciones activas.")
        return
    for s in elements:
        print(f"  ID: {s.get('id')} | topic: {s.get('topics')} | url: {s.get('publicationUrl')}")


def delete_sub(subscription_id: str) -> None:
    r = requests.delete(
        f"{BASE}/API/v3/eventsubscriptions/{subscription_id}",
        headers=HEADERS, timeout=15
    )
    print(f"HTTP {r.status_code}")
    print(r.text)


def test_local(response_id: str, local_url: str = "http://localhost:8000") -> None:
    url     = f"{local_url.rstrip('/')}/webhook/qualtrics?secret={SECRET}"
    payload = {"SurveyID": SURVEY, "ResponseID": response_id}
    r = requests.post(url, json=payload, timeout=15)
    print(f"HTTP {r.status_code}")
    print(r.text)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(0)

    if args[0] == "--register" and len(args) == 2:
        register(args[1])
    elif args[0] == "--list":
        list_subs()
    elif args[0] == "--delete" and len(args) == 2:
        delete_sub(args[1])
    elif args[0] == "--test" and len(args) == 2:
        test_local(args[1])
    elif args[0] == "--test" and len(args) == 3:
        test_local(args[1], args[2])
    else:
        print(__doc__)
        sys.exit(1)
