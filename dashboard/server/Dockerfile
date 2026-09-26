FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    util-linux \
    && rm -rf /var/lib/apt/lists/*

# Install IBM Bob Shell and automatically select npm
RUN curl -fsSL https://bob.ibm.com/download/bobshell.sh -o /tmp/bobshell.sh \
    && chmod +x /tmp/bobshell.sh \
    && printf "1\n" | script -q -c "bash /tmp/bobshell.sh" /dev/null

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]

CMD ["node", "index.js"]