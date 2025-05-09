import 'dotenv/config';
import { capitalize, InstallGlobalCommands } from './utils.js';

const YOUTUBE_COMMAND = {
  name: 'youtube',
  description: 'Recebe um link do YouTube e retorna título, descrição e thumbnail.',
  type: 1,
  integration_types: [0, 1],
  contexts: [0, 1, 2],
  options: [
    {
      name: 'link',
      description: 'Link do vídeo do YouTube',
      type: 3, // STRING
      required: true,
    },
  ],
};

const ALL_COMMANDS = [YOUTUBE_COMMAND];

InstallGlobalCommands(process.env.APP_ID, ALL_COMMANDS);
