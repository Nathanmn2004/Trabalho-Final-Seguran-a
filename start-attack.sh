#!/bin/bash

echo "================================================"
echo "   ATAQUE DISTRIBUÍDO — 20 BOTS"
echo "================================================"
echo ""
echo "Escolha o alvo:"
echo "  1) Localhost (mesma máquina, sem ngrok)"
echo "  2) Ngrok (servidor remoto / outra máquina)"
echo ""
read -p "Opção [1/2]: " OPCAO

if [ "$OPCAO" = "1" ]; then
  export SERVER_URL="http://host.docker.internal:3000/login"
  echo ""
  echo "Alvo: $SERVER_URL"

elif [ "$OPCAO" = "2" ]; then
  echo ""
  read -p "Cole a URL do ngrok (ex: https://abc123.ngrok-free.app): " NGROK_URL

  if [ -z "$NGROK_URL" ]; then
    echo "URL não informada. Abortando."
    exit 1
  fi

  export SERVER_URL="${NGROK_URL}/login"
  echo ""
  echo "Alvo: $SERVER_URL"

else
  echo "Opção inválida. Abortando."
  exit 1
fi

echo "Iniciando 20 atacantes..."
echo ""

docker-compose -f docker-compose.attack.yml up --build
