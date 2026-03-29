networks:
  bruteforce_net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/24

services:
  # Servidor de autenticação
  server:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - ./:/app
    command: sh -c "npm install && node server.js"
    ports:
      - "3000:3000"
    networks:
      bruteforce_net:
        ipv4_address: 172.20.0.10
    # Healthcheck: só passa quando o servidor está no ar E a senha já foi configurada
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://172.20.0.10:3000/status | grep -q '\"passwordSet\":true'"]
      interval: 3s
      timeout: 3s
      retries: 30
      start_period: 5s

  # Atacante 1 de 6
  attacker_1:
    build: .
    volumes:
      - ./wordlist.txt:/app/wordlist.txt
    environment:
      - TOTAL_ATTACKERS=6
      - ATTACKER_INDEX=0
      - SERVER_URL=http://172.20.0.10:3000/login
      - ATTACKER_ID=1
      - MODE=hybrid
      - WORDLIST_PATH=/app/wordlist.txt
    networks:
      bruteforce_net:
        ipv4_address: 172.20.0.21
    depends_on:
      server:
        condition: service_healthy

  # Atacante 2 de 6
  attacker_2:
    build: .
    volumes:
      - ./wordlist.txt:/app/wordlist.txt
    environment:
      - TOTAL_ATTACKERS=6
      - ATTACKER_INDEX=1
      - SERVER_URL=http://172.20.0.10:3000/login
      - ATTACKER_ID=2
      - MODE=hybrid
      - WORDLIST_PATH=/app/wordlist.txt
    networks:
      bruteforce_net:
        ipv4_address: 172.20.0.22
    depends_on:
      server:
        condition: service_healthy

  # Atacante 3 de 6
  attacker_3:
    build: .
    volumes:
      - ./wordlist.txt:/app/wordlist.txt
    environment:
      - TOTAL_ATTACKERS=6
      - ATTACKER_INDEX=2
      - SERVER_URL=http://172.20.0.10:3000/login
      - ATTACKER_ID=3
      - MODE=hybrid
      - WORDLIST_PATH=/app/wordlist.txt
    networks:
      bruteforce_net:
        ipv4_address: 172.20.0.23
    depends_on:
      server:
        condition: service_healthy

  # Atacante 4 de 6
  attacker_4:
    build: .
    volumes:
      - ./wordlist.txt:/app/wordlist.txt
    environment:
      - TOTAL_ATTACKERS=6
      - ATTACKER_INDEX=3
      - SERVER_URL=http://172.20.0.10:3000/login
      - ATTACKER_ID=4
      - MODE=hybrid
      - WORDLIST_PATH=/app/wordlist.txt
    networks:
      bruteforce_net:
        ipv4_address: 172.20.0.24
    depends_on:
      server:
        condition: service_healthy

  # Atacante 5 de 6
  attacker_5:
    build: .
    volumes:
      - ./wordlist.txt:/app/wordlist.txt
    environment:
      - TOTAL_ATTACKERS=6
      - ATTACKER_INDEX=4
      - SERVER_URL=http://172.20.0.10:3000/login
      - ATTACKER_ID=5
      - MODE=hybrid
      - WORDLIST_PATH=/app/wordlist.txt
    networks:
      bruteforce_net:
        ipv4_address: 172.20.0.25
    depends_on:
      server:
        condition: service_healthy

  # Atacante 6 de 6
  attacker_6:
    build: .
    volumes:
      - ./wordlist.txt:/app/wordlist.txt
    environment:
      - TOTAL_ATTACKERS=6
      - ATTACKER_INDEX=5
      - SERVER_URL=http://172.20.0.10:3000/login
      - ATTACKER_ID=6
      - MODE=hybrid
      - WORDLIST_PATH=/app/wordlist.txt
    networks:
      bruteforce_net:
        ipv4_address: 172.20.0.26
    depends_on:
      server:
        condition: service_healthy