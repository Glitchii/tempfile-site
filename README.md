(Discontinued) A website that temporarily stores files to a certain date or time.

# Using Requests
Requests are done on the api path (/api/files/). After each request, a json response will be returned containing an 'ok' key (bool) to signify if it was successful or not. For example after a successful post request to upload a file, the output should look something like this:  
`{"ok":true,"link":"https://tempfile.site/files/filename.png"}`


## Getting a file
Use a get request to get a file eg.
```bash
curl -O http://tempfile.site/api/files/filename.png
```
If a file requires a password, send the password in a header with a pass key eg. 
```bash
curl -O http://tempfile.site/api/files/filename.png -H "pass: the password"
```

## Uploading a file
Use a post request to upload files with the file and the expiry date / time, eg.
```bash
curl -F datetime=1m -F file=@/path/to/file.png http://tempfile.site/api/files
```
For the expiry date, you can either use a timestamp string or a number with a unit eg. `3m` for 3 minutes, `1w` for a week, `1mo` for 1 month or `2002-05-19T:08:00.000Z` for my birthday (just make sure it's not in the past)

To use a custom filename, use a form argument with a name parameter (`-F name=file-name`). Filenames should not have special characters that aren't url friendly, in other words, it should follow this pattern `[a-z0-9-_\.]`.

**Other options:**
```yaml
limit: Download limit, don't add this for unlimited. (-F limit=5). After this limit, file will be deleted

pass: Password protect the file. (-F pass="A password")

ipblacklist: An IP to blacklist from downloading file. (-F ipblacklist="69.80.31.225"). For more than one IP, use a comma as separator instead of setting another form (-F), eg. -F ipblacklist="68.80.31.225,50.90.30.222"

ipwhitelist: If added, file will only be downloaded from this IP. And as mentioned above, you can seperate by a command if more than one.

authkey: Without this key, you won't be able to delete the file if it was not posted from the same IP. If you don't give a custom authkey parameter, it will be gerenerated for you and returned alongside the file link in response
```
*All options must be lowercase.*
## Deleting a file
To delete a file you'll need to send a delete request to the file eg.
```bash
curl -X DELETE http://tempfile.site/api/files/filename.png
```
You can delete the file if it was uploaded from the same IP address, otherwise you will need an auth key. You can find the auth key by clicking 'more' from the options on the website before uploading.  
To delete the file with the auth key you must send the key from a header named "authkey" eg.
```bash
curl -X DELETE http://tempfile.site/api/files/filename.png -H "authkey: the key"
```
