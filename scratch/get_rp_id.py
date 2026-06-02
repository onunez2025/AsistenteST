import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def get_rp_id():
    object_id = "277054CBB1AA1EDF8D94C3FB845FF2DF"
    url = f"{base_url}/RegisteredProductCollection?$filter=ObjectID eq '{object_id}'&$format=json"
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code == 200:
        results = resp.json().get('d', {}).get('results', [])
        for r in results:
            print(f"ID: {r.get('ID')}")
            for k, v in sorted(r.items()):
                if not isinstance(v, dict):
                    print(f"  {k}: {v}")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    get_rp_id()
