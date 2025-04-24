services:
  - type: web
    name: clickup-mcp-server
    env: node
    buildCommand: npm install && npm run build
    startCommand: USE_HTTP=true node build/index.js
    envVars:
      - key: USE_HTTP
        value: "true"
      - key: CLICKUP_API_KEY
        sync: false
      - key: CLICKUP_TEAM_ID
        sync: false
