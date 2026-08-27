# TempFile

[TempFile](http://localhost:3001) (temporarily using localhost for demo while I renew domain) is a website for temporary file and text uploads. Uploads can expire after a chosen time and can optionally use passwords, download limits, custom names, IP rules, and deletion keys.

## Using the API and responses

You can also upload via the API. All example will be using curl but you can replicate with any HTTP client. The API is available at `/api/files` and `/api/files/:name`.  

Every API response is JSON unless a file is downloaded. Successful responses contain `"ok": true`, otherwise `"ok": false` and an `error` object.

A successful upload resembles:

```json
{
  "ok": true,
  "link": "http://localhost:3001/files/example.png",
  "authkey": "memorable.deletion.key",
  "deletion": "To delete, make a DELETE request..."
}
```

## Upload

Send a multipart `POST` request to `/api/files`. Include `datetime` and either `file` or `text`.

```bash
curl -F datetime=5m -F file=@./image.png http://localhost:3001/api/files
curl -F datetime=1h -F text="Temporary note" http://localhost:3001/api/files
```

The `datetime` value can be an ISO date or a number followed by `m`, `h`, `d`, `w`, or `mo`. It must be at least one minute and no more than 31 days in the future.

Optional multipart fields:

| Field | Purpose |
| --- | --- |
| `name` | Preferred URL-friendly file name. The original extension is retained for file uploads. |
| `limit` | Positive whole-number download limit. The upload is deleted after the final download. |
| `pass` | Password of at most 72 bytes. |
| `ipblacklist` | Up to five comma-separated IPv4 or IPv6 addresses denied access. |
| `ipwhitelist` | Up to five comma-separated addresses allowed access; all others are denied. |
| `authkey` | Custom deletion key. A secure key is generated and returned when omitted. |

For example:

```bash
curl \
  -F datetime=2d \
  -F file=@./report.pdf \
  -F name=weekly-report \
  -F limit=5 \
  -F pass="file password" \
  -F ipblacklist="192.0.2.10,2001:db8::10" \
  -F authkey="my.deletion.key" \
  http://localhost:3001/api/files
```

## Download

Browser download URLs use `/files/:name`. API clients can use `/api/files/:name`.

```bash
curl -O http://localhost:3001/api/files/example.png
curl -O http://localhost:3001/api/files/example.png -H "pass: file password"
```

Opening a password-protected `/files/:name` URL in a browser redirects to the authentication page. A password is correct, a signed, HTTP-only cookie would be set for that file for ~15 minutes.

Public metadata can be read without downloading the file:

```bash
curl http://localhost:3001/api/files/example.png/info
```

## Delete

Delete from the uploader's IP without a key, or provide the upload's authentication key from another IP:

```bash
curl -X DELETE http://localhost:3001/api/files/example.png
curl -X DELETE http://localhost:3001/api/files/example.png \
  -H "authkey: memorable.deletion.key"
```

Auth key is just used for deleting if IP doens't match, it's not the optional download password
