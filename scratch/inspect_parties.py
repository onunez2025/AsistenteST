import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def inspect_parties():
    # Fetch top 1 from RegisteredProductPartyInformationCollection
    url = f"{base_url}/RegisteredProductPartyInformationCollection?$top=1&$format=json"
    print("Fetching top 1 from RegisteredProductPartyInformationCollection...")
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code == 200:
        results = resp.json().get('d', {}).get('results', [])
        if results:
            print("Fields in RegisteredProductPartyInformationCollection:")
            for k in sorted(results[0].keys()):
                print(f"  {k}: {results[0][k]}")
        else:
            print("No records in RegisteredProductPartyInformationCollection")
    else:
        print(f"Error {resp.status_code}: {resp.text[:500]}")

    # Let's search RegisteredProductPartyInformationCollection where PartyID or PartyCustomerID is '1125569'
    candidates = ["PartyID", "PartyCustomerID", "CustomerID", "AccountID", "IndividualCustomerID"]
    customer_id = "1125569"
    for cand in candidates:
        url_filter = f"{base_url}/RegisteredProductPartyInformationCollection?$filter={cand} eq '{customer_id}'&$format=json"
        print(f"Trying filter on RegisteredProductPartyInformationCollection: {cand} eq '{customer_id}'...")
        resp_f = requests.get(url_filter, auth=HTTPBasicAuth(user, password))
        if resp_f.status_code == 200:
            res = resp_f.json().get('d', {}).get('results', [])
            print(f"  Success! Found {len(res)} party assignments.")
            for r in res:
                print(f"    - ObjectID: {r.get('ObjectID')} | ParentObjectID: {r.get('ParentObjectID')} | Role: {r.get('RoleCodeText')} ({r.get('RoleCode')})")
                for k, v in sorted(r.items()):
                    if not isinstance(v, dict):
                        print(f"      {k}: {v}")
        else:
            print(f"  Failed: {resp_f.status_code}")

if __name__ == "__main__":
    inspect_parties()
