import React from "react"

export default function TokenInvalid() {
  return (
    <div className="token-invalid">
      <div className="icon">⚠</div>
      <h2>Session Expired</h2>
      <p>Your token is invalid or missing. Please re-login through the web app.</p>
      <a
        href="http://localhost:3000"
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary">
        Go to Web App
      </a>
    </div>
  )
}
