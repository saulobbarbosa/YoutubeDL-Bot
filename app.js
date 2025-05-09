import 'dotenv/config';
import express from 'express';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import {
  InteractionResponseType,
  InteractionType,
  verifyKeyMiddleware,
  MessageComponentTypes,
  ButtonStyleTypes,
} from 'discord-interactions';

// Setup
const app = express();
const exec = promisify(execCallback);
const PORT = process.env.PORT || 6060;
const DOWNLOAD_DIR = path.join(process.cwd(), 'downloads');

// Cria a pasta se não existir
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);
app.get('/downloads/:filename', (req, res) => {
  const filePath = path.join(DOWNLOAD_DIR, req.params.filename);
  res.download(filePath, err => {
    if (err && !res.headersSent) {
      console.error('Erro ao enviar arquivo para download:', err);
      res.status(404).send('Arquivo não encontrado.');
    } else if (err) {
      console.error('Erro ao enviar arquivo (headers já enviados):', err);
    }
  });
});

// Middleware
app.post('/interactions', express.json(), verifyKeyMiddleware(process.env.PUBLIC_KEY), async (req, res) => {
  const { type, data, token } = req.body;

  // Ping do Discord
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  // Comando /youtube
  if (type === InteractionType.APPLICATION_COMMAND && data.name === 'youtube') {
    const link = data.options.find(opt => opt.name === 'link')?.value;
    res.send({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });

    try {
      const { stdout } = await exec(`yt-dlp --dump-json "${link}"`, { timeout: 300_000 });
      const jsonStr = stdout.trim().split('\n').pop();
      const videoData = JSON.parse(jsonStr);

      const embed = {
        title: videoData.title,
        url: videoData.webpage_url,
        description: videoData.description?.slice(0, 2048),
        image: { url: videoData.thumbnail },
      };

      const encodedUrl = Buffer.from(videoData.webpage_url).toString('base64');

      const components = [
        {
          type: MessageComponentTypes.ACTION_ROW,
          components: [
            {
              type: MessageComponentTypes.BUTTON,
              label: 'Download',
              custom_id: `download:${encodedUrl}`,
              style: ButtonStyleTypes.PRIMARY,
            },
          ],
        },
      ];

      await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${token}/messages/@original`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        },
        body: JSON.stringify({ embeds: [embed], components }),
      });
    } catch (err) {
      console.error('Erro ao executar yt-dlp:', err);
      await fetch(`https://discord.com/api/v10/webhooks/${process.env.APP_ID}/${token}/messages/@original`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
        },
        body: JSON.stringify({ content: 'Erro ao processar o vídeo. Verifique o link.' }),
      });
    }
    return;
  }

  // Clique no botão Download
  if (type === InteractionType.MESSAGE_COMPONENT && data.custom_id.startsWith('download:')) {
    const url = Buffer.from(data.custom_id.split(':')[1], 'base64').toString('utf-8');

    return res.send({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Escolha o formato para download:',
        components: [
          {
            type: MessageComponentTypes.ACTION_ROW,
            components: [
              {
                type: 3, // Select Menu
                custom_id: `select_format:${Buffer.from(url).toString('base64')}`,
                options: [
                  { label: 'Vídeo (MP4)', value: 'video' },
                  { label: 'Áudio (MP3)', value: 'audio' },
                ],
              },
            ],
          },
        ],
      },
    });
  }

  // Seleção do formato
  if (type === InteractionType.MESSAGE_COMPONENT && data.component_type === 3) {
    const token = req.body.token;
    const appId = process.env.APP_ID;
    const choice = data.values[0];
    const url = Buffer.from(data.custom_id.split(':')[1], 'base64').toString('utf-8');

    // Envia a resposta para não dar timeout
    res.send({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    });

    // Executa o restante fora da resposta
    (async () => {

      const format = choice === 'video'
        ? '-f bestvideo+bestaudio --merge-output-format mp4'
        : '-f bestaudio --extract-audio --audio-format mp3 --audio-quality 0';

      try {
        // Obtém os dados do vídeo com yt-dlp
        const { stdout } = await exec(`yt-dlp --dump-json "${url}"`);
        const videoData = JSON.parse(stdout.trim().split('\n').pop());

        // Sanitiza o título para gerar um nome de arquivo seguro
        const safeTitle = videoData.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').trim();
        const extension = choice === 'video' ? 'mp4' : 'mp3';
        const finalFilename = `${safeTitle}.${extension}`;
        const fullPath = path.join(DOWNLOAD_DIR, finalFilename);

        // Faz o download com o nome de arquivo sanitizado
        await exec(`yt-dlp ${format} -o "${fullPath}" "${url}"`, { timeout: 300_000 });

        // Envia o link de download com nome seguro
        const downloadUrl = `https://wildcat-light-loosely.ngrok-free.app/downloads/${encodeURIComponent(finalFilename)}`;
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
          },
          body: JSON.stringify({ content: `✅ Download pronto: ${downloadUrl}` }),
        });

      } catch (err) {
        console.error('Erro ao baixar:', err);
        await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
          },
          body: JSON.stringify({ content: '❌ Erro ao baixar o vídeo/áudio.' }),
        });
      }
    })();
  }
});

// Start do servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
