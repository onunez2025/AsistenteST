import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def search_customer():
    # We will try substring of name in IndividualCustomerCollection first
    # Standard query filter is substringof('search_str', Property)
    # Let's try searching for "OSCAR" or "NUÑEZ" or "VARGAS"
    
    # We will search "OSCAR" first to be safe and print all matches
    search_term = "OSCAR ARMANDO"
    
    collections = [
        ("IndividualCustomerCollection", "Name"),
        ("CustomerCollection", "Name"),
        ("CorporateAccountCollection", "Name"),
        ("ContactCollection", "Name")
    ]
    
    found_customers = []
    
    for coll, field in collections:
        # Try filtering
        url = f"{base_url}/{coll}?$filter=substringof('{search_term}', {field})&$format=json"
        print(f"Querying {coll} for '{search_term}'...")
        try:
            resp = requests.get(url, auth=HTTPBasicAuth(user, password))
            if resp.status_code == 200:
                results = resp.json().get('d', {}).get('results', [])
                print(f"  Found {len(results)} results in {coll}")
                for r in results:
                    customer_id = r.get('CustomerID') or r.get('ID')
                    name = r.get('Name') or r.get('FormattedName')
                    print(f"    - ID: {customer_id} | Name: {name}")
                    found_customers.append((coll, customer_id, name, r))
            else:
                # Some collections might not exist or field name might differ
                # Let's try a simpler query or check if there is an error
                print(f"  Error {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            print(f"  Exception querying {coll}: {e}")
            
    return found_customers

if __name__ == "__main__":
    search_customer()
