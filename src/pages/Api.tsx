export default function Api() {
    const origin = typeof window === 'undefined' ? 'https://tempfile.site' : window.location.origin

    return (
        <section className="route-page api-page">
            <article>
                <h1>TempFile API</h1>
                <p>Upload a file or text with a required expiry. Expiry can be relative, like <code>5m</code>, <code>2h</code>, <code>1d</code>, or an ISO/date-time string up to 31 days ahead.</p>

                <h2 id="upload">Upload</h2>
                <pre><code>{`curl -F datetime=5m -F file=@./image.png ${origin}/api/files`}</code></pre>
                <pre><code>{`curl -F datetime=1h -F name=note -F text='hello world' ${origin}/api/files`}</code></pre>

                <h2 id="upload-options">Options</h2>
                <table>
                    <tbody>
                        <tr><th>Field</th><th>Meaning</th></tr>
                        <tr><td><code>limit</code></td><td>Delete after this many downloads.</td></tr>
                        <tr><td><code>pass</code></td><td>Password protect download requests.</td></tr>
                        <tr><td><code>name</code></td><td>Custom file name.</td></tr>
                        <tr><td><code>authkey</code></td><td>Key required to delete from a different IP.</td></tr>
                        <tr><td><code>ipblacklist</code></td><td>Comma-separated IPs to block.</td></tr>
                        <tr><td><code>ipwhitelist</code></td><td>Comma-separated IPs to allow; all others are blocked.</td></tr>
                    </tbody>
                </table>

                <h2 id="download">Download</h2>
                <pre><code>{`curl -O ${origin}/files/example.png`}</code></pre>
                <pre><code>{`curl -O ${origin}/files/example.png -H "pass: file password"`}</code></pre>

                <h2 id="delete">Delete</h2>
                <pre><code>{`curl -X DELETE ${origin}/api/files/example.png`}</code></pre>
                <pre><code>{`curl -X DELETE ${origin}/api/files/example.png -H "authkey: your key"`}</code></pre>
            </article>
        </section>
    )
}
