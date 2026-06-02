import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def get_products():
    customer_id = "1125569"
    # We will search the RegisteredProductPartyInformationCollection
    # to find which RegisteredProduct (ParentObjectID) belongs to this PartyID (Customer)
    
    # Try PartyID first
    url = f"{base_url}/RegisteredProductPartyInformationCollection?$filter=PartyID eq '{customer_id}'&$format=json"
    print(f"Querying RegisteredProductPartyInformationCollection for PartyID '{customer_id}'...")
    
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code != 200:
        print(f"Error {resp.status_code}: {resp.text}")
        return
        
    results = resp.json().get('d', {}).get('results', [])
    print(f"Found {len(results)} party assignments.")
    
    if not results:
        print("No registered products found linked to this Customer ID.")
        return
        
    for r in results:
        parent_id = r.get('ParentObjectID')
        role_text = r.get('RoleCodeText')
        role_code = r.get('RoleCode')
        print(f"\n--- Party Link: ParentObjectID={parent_id} | Role={role_text} ({role_code}) ---")
        
        # Now fetch the Registered Product details using ParentObjectID (which is the ObjectID of the RegisteredProduct)
        rp_url = f"{base_url}/RegisteredProductCollection?$filter=ObjectID eq '{parent_id}'&$format=json"
        rp_resp = requests.get(rp_url, auth=HTTPBasicAuth(user, password))
        if rp_resp.status_code == 200:
            rp_results = rp_resp.json().get('d', {}).get('results', [])
            for rp in rp_results:
                prod_id = rp.get('ProductID')
                serial_id = rp.get('SerialID')
                status = rp.get('StatusText')
                city = rp.get('City')
                street = rp.get('Street')
                
                # Fetch product description from RegisteredProductDescription or Description
                # Actually let's fetch the Product entity or use its OData navigation if available.
                # In C4C, there is a ProductCollection where we can get the Product Name
                prod_name = "N/A"
                if prod_id:
                    prod_url = f"{base_url}/ProductCollection('{prod_id}')?$format=json"
                    prod_resp = requests.get(prod_url, auth=HTTPBasicAuth(user, password))
                    if prod_resp.status_code == 200:
                        prod_name = prod_resp.json().get('d', {}).get('results', {}).get('Description') or "N/A"
                    else:
                        # Try without key if it is not the key
                        prod_url_f = f"{base_url}/ProductCollection?$filter=ProductID eq '{prod_id}'&$format=json"
                        prod_resp_f = requests.get(prod_url_f, auth=HTTPBasicAuth(user, password))
                        if prod_resp_f.status_code == 200:
                            p_res = prod_resp_f.json().get('d', {}).get('results', [])
                            if p_res:
                                prod_name = p_res[0].get('Description') or p_res[0].get('Name') or "N/A"
                
                print(f"  ProductID: {prod_id} | Name: {prod_name}")
                print(f"  Serial ID: {serial_id}")
                print(f"  Status: {status}")
                print(f"  Address: {street}, {city}")
        else:
            print(f"  Error fetching RegisteredProduct: {rp_resp.status_code}")

if __name__ == "__main__":
    get_products()
