import requests
import os
from requests.auth import HTTPBasicAuth
from dotenv import load_dotenv

load_dotenv()

base_url = os.getenv('SAP_BASE_URL')
user = os.getenv('SAP_USER')
password = os.getenv('SAP_PASSWORD')

def get_concepts():
    url = f"{base_url}/ServiceRequestCollection?$top=1000&$select=zaConceptodeservicio_KUT,zaConceptodeservicio_KUTText,ServiceTermsServiceIssueName,zIDEmpresa_SDK,zTicketArea_SDK&$format=json"
    print("Fetching ticket concepts and issues...")
    resp = requests.get(url, auth=HTTPBasicAuth(user, password))
    if resp.status_code == 200:
        results = resp.json().get('d', {}).get('results', [])
        unique_concepts = {}
        unique_issues = {}
        installation_examples = []
        
        for r in results:
            concept_code = r.get('zaConceptodeservicio_KUT')
            concept_text = r.get('zaConceptodeservicio_KUTText')
            issue_name = r.get('ServiceTermsServiceIssueName')
            
            if concept_code:
                unique_concepts[concept_code] = concept_text
            if issue_name:
                unique_issues[issue_name] = unique_issues.get(issue_name, 0) + 1
                
            if issue_name and "instal" in issue_name.lower():
                installation_examples.append(r)
                
        print("\nUnique Service Concepts (zaConceptodeservicio_KUT):")
        for code, text in unique_concepts.items():
            print(f"  Code: {code} | Text: {text}")
            
        print("\nUnique Service Issues (ServiceTermsServiceIssueName) counts:")
        for issue, count in sorted(unique_issues.items(), key=lambda x: x[1], reverse=True):
            print(f"  {issue}: {count}")
            
        print("\nExamples of Installation Tickets:")
        for idx, r in enumerate(installation_examples[:5]):
            print(f"  Example {idx+1}:")
            print(f"    Issue: {r.get('ServiceTermsServiceIssueName')}")
            print(f"    Concept: {r.get('zaConceptodeservicio_KUT')} ({r.get('zaConceptodeservicio_KUTText')})")
            print(f"    Empresa: {r.get('zIDEmpresa_SDK')}")
            print(f"    Area: {r.get('zTicketArea_SDK')}")
    else:
        print(f"Error {resp.status_code}: {resp.text}")

if __name__ == "__main__":
    get_concepts()
