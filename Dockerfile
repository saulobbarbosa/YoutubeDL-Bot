# Usa a imagem oficial do Node.js
FROM node:20-alpine

# Cria diretório de trabalho
WORKDIR /app

# Copia os arquivos para o container
COPY . .

# Instala dependências do sistema, yt-dlp e jq
RUN apk add --no-cache curl unzip python3 ffmpeg jq && \
    # Instala yt-dlp
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    # Instala dependências do Node.js se necessário
    npm install

# Expõe a porta do app
EXPOSE 6060

# Executa o servidor Node.js (ajuste conforme o script principal do seu app)
CMD ["node", "./app.js"]
