# TempFile

[TempFile](http://localhost:3001) (temporarily using localhost for demo while I renew domain) is a website for temporary file and text uploads. Uploads can expire after a chosen time and can optionally use passwords, download limits, custom names, IP rules, and deletion keys.

### Using the API and responses

You can also upload via the API. All examples below use curl, but you can replicate them with any HTTP client. The API is available under `/api/files`.

Every API response is JSON. Successful responses contain `"ok": true`, otherwise `"ok": false` and an `error` object.

A successful upload resembles:

```json
{
  "ok": true,
  "link": "http://localhost:3001/files/example.png",
  "authkey": "memorable.deletion.key",
  "deletion": "To delete, make a DELETE request..."
}
```

### Upload

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

### Download

All browser and API-client downloads use `/files/:name`. Password-protected downloads accept a `pass` header or redirect to the browser authentication page.

```bash
curl -O http://localhost:3001/files/example.png
curl -O http://localhost:3001/files/example.png -H "pass: file password"
```

Opening a password-protected `/files/:name` URL without a valid `pass` header redirects to the authentication page. A correct password sets a signed, HTTP-only cookie for that file for about 15 minutes.

Public metadata can be read without downloading the file:

```bash
curl http://localhost:3001/api/files/example.png/info
```

### Delete

Delete from the uploader's IP without a key, or provide the upload's authentication key from another IP:

```bash
curl -X DELETE http://localhost:3001/api/files/example.png
curl -X DELETE http://localhost:3001/api/files/example.png \
  -H "authkey: memorable.deletion.key"
```

The authentication key is only used for deletion when the uploader's IP does not match. It is separate from the optional download password.
