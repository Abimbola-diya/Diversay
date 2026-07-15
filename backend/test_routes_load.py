import urllib.request
import json

def test_load():
    base_url = "http://localhost:8000"
    
    # 1. Login
    login_data = json.dumps({"email": "diversaysolutions@gmail.com", "password": "diversaysolutions@2025"}).encode('utf-8')
    req = urllib.request.Request(
        f"{base_url}/auth/login",
        data=login_data,
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            token = res_data["access_token"]
            print("Logged in successfully! Token received.")
    except Exception as e:
        print(f"Login failed: {e}")
        return

    # 2. Get /drivers
    req_drivers = urllib.request.Request(
        f"{base_url}/drivers",
        headers={"Authorization": f"Bearer {token}"}
    )
    try:
        with urllib.request.urlopen(req_drivers) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            print(f"GET /drivers status: {response.status}")
            print(res_data[:3])
    except urllib.error.HTTPError as e:
        print(f"GET /drivers HTTP Error {e.code}: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"GET /drivers failed: {e}")

    # 3. Get /vehicles
    req_vehicles = urllib.request.Request(
        f"{base_url}/vehicles",
        headers={"Authorization": f"Bearer {token}"}
    )
    try:
        with urllib.request.urlopen(req_vehicles) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            print(f"GET /vehicles status: {response.status}")
            print(res_data[:3])
    except urllib.error.HTTPError as e:
        print(f"GET /vehicles HTTP Error {e.code}: {e.read().decode('utf-8')}")
    except Exception as e:
        print(f"GET /vehicles failed: {e}")

if __name__ == "__main__":
    test_load()
