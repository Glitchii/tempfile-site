# TempFiles.co <!-- [TempFiles.co](https://tempfiles.co) -->

A temporary file storage service with options to choose expiry date and time, password protect, limit downloads, pick custom names, IP blacklisting and whitelisting, etc.

### Using the API and responses

You can also upload via the API. All examples below use curl, but you can replicate them with any HTTP client. The API is available under `/files`.

Upload, metadata, authentication, and deletion responses are JSON. Successful responses contain `"ok": true`, otherwise `"ok": false` and an `error` object. Downloads return the uploaded file or text.

A successful upload resembles:

```json
{
  "ok": true,
  "link": "https://tempfiles.co/files/example.png",
  "authkey": "memorable.deletion.key",
  "deletion": "To delete, make a DELETE request..."
}
```

### Upload

Send a multipart `POST` request to `/files`. Include `datetime` and either `file` or `text`.

```bash
curl -F datetime=5m -F file=@./image.png https://tempfiles.co/files
curl -F datetime=1h -F text="Temporary note" https://tempfiles.co/files
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
  https://tempfiles.co/files
```

### Download

All browser and API-client downloads use `/files/:name`. Password-protected downloads accept a `pass` header or redirect to the browser authentication page.

```bash
curl -O https://tempfiles.co/files/example.png
curl -O https://tempfiles.co/files/example.png -H "pass: file password"
```

Opening a password-protected `/files/:name` URL without a valid `pass` header redirects to the authentication page. A correct password sets a signed, HTTP-only cookie for that file for about 15 minutes.

Public metadata can be read without downloading the file:

```bash
curl https://tempfiles.co/files/example.png/info
```

### Delete

Delete from the browser that uploaded the file without a key, or provide the upload's authentication key from another browser, device, or API client:

```bash
curl -X DELETE https://tempfiles.co/files/example.png
curl -X DELETE https://tempfiles.co/files/example.png \
  -H "authkey: memorable.deletion.key"
```

The server recognises the uploading browser with a secure, HTTP-only cookie that expires with the file. The authentication key is used when that cookie is unavailable and is separate from the optional download password.
