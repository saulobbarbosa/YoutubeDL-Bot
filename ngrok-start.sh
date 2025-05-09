
# Configura o authtoken do ngrok
ngrok config add-authtoken "$NGROK_AUTH_TOKEN"

# Inicia o app em segundo plano
node app.js &

# Aguarda o app iniciar
sleep 2

# Inicia o túnel do ngrok
ngrok http --url=wildcat-light-loosely.ngrok-free.app 6060