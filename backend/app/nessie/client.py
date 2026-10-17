"""Small transport with deliberately conservative write retry behavior."""
import time
from decimal import Decimal, ROUND_HALF_UP
import httpx

class RemoteError(Exception):
    def __init__(self, message, *, ambiguous=False, retryable=False):
        super().__init__(message)
        self.ambiguous = ambiguous
        self.retryable = retryable

def coins(minor: int) -> float:
    return float(Decimal(minor) / 100)

def minor_units(value) -> int:
    return int((Decimal(str(value)) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))

class NessieClient:
    def __init__(self, settings, transport=None):
        self.http = httpx.Client(base_url=settings.base_url, params={'key': settings.api_key},
                                 timeout=8, transport=transport, follow_redirects=False)

    def close(self):
        self.http.close()

    def request(self, method, path, payload=None):
        for attempt in range(3 if method == 'GET' else 1):
            try:
                response = self.http.request(method, path, json=payload)
            except (httpx.ConnectError, httpx.ConnectTimeout):
                if method == 'GET' and attempt < 2:
                    time.sleep(0.1 * 2 ** attempt)
                    continue
                raise RemoteError('Nessie connection unavailable', retryable=True) from None
            except httpx.RequestError:
                raise RemoteError('Nessie response interrupted', ambiguous=method != 'GET', retryable=method == 'GET') from None
            if response.status_code >= 400:
                if method == 'GET' and (response.status_code == 429 or response.status_code >= 500) and attempt < 2:
                    time.sleep(0.1 * 2 ** attempt)
                    continue
                raise RemoteError(f'Nessie returned HTTP {response.status_code}',
                                  ambiguous=method != 'GET' and response.status_code >= 500,
                                  retryable=response.status_code == 429 or (method == 'GET' and response.status_code >= 500))
            if response.is_redirect:
                raise RemoteError('Unexpected Nessie redirect; verify configured host')
            if method == 'PUT' and response.status_code == 204:
                return {}
            try:
                return response.json()
            except ValueError:
                raise RemoteError('Nessie returned an unreadable response', ambiguous=method != 'GET') from None

    def get(self, path):
        return self.request('GET', path)

    def post(self, path, payload):
        return self.request('POST', path, payload)

    def put(self, path, payload):
        return self.request('PUT', path, payload)
