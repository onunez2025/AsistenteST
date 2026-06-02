import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def inspect_and_get_products():
    customer_id = "1125569"
    
    # 1. Fetch top 1 from RegisteredProductCollection
    url_rp_top = f"{base_url}/RegisteredProductCollection?$top=1&$format=json"
    print("Fetching top 1 from RegisteredProductCollection to inspect fields...")
    resp = requests.get(url_rp_top, auth=HTTPBasicAuth(user, password))
    if resp.status_code == 200:
        results = resp.json().get('d', {}).get('results', [])
        if results:
            print("Fields in RegisteredProductCollection:")
            for k in sorted(results[0].keys()):
                print(f"  {k}: {results[0][k]}")
        else:
            print("No records in RegisteredProductCollection")
    else:
        print(f"Error {resp.status_code} fetching top RegisteredProduct: {resp.text[:500]}")

    # Let's try querying RegisteredProductCollection filtering by CustomerID or AccountID
    # We can try several candidate fields: CustomerID, AccountID, IndividualCustomerID
    candidates = ["CustomerID", "AccountID", "IndividualCustomerID"]
    for field in candidates:
        url_filter = f"{base_url}/RegisteredProductCollection?$filter={field} eq '{customer_id}'&$format=json"
        print(f"Trying filter: {field} eq '{customer_id}'...")
        resp_f = requests.get(url_filter, auth=HTTPBasicAuth(user, password))
        if resp_f.status_code == 200:
            res = resp_f.json().get('d', {}).get('results', [])
            print(f"  Success. Found {len(res)} products with {field} eq '{customer_id}'")
            for r in res:
                print(f"    - ID: {r.get('ID')} | Serial: {r.get('SerialID')} | ProductID: {r.get('ProductID')} | Description: {r.get('ProductDescription') or r.get('Description')}")
                # Print all fields of the found product
                for k, v in sorted(r.items()):
                    if not isinstance(v, dict):
                        print(f"      {k}: {v}")
        else:
            print(f"  Failed: {resp_f.status_code}")

if __name__ == "__main__":
    inspect_and_get_products()
