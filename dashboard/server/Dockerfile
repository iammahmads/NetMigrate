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

# Server app code
COPY dashboard/server/package*.json ./
RUN npm install
COPY dashboard/server/ .

# Bake in Bob's generated analysis artifacts so the container is
# self-contained and doesn't depend on the host filesystem at deploy time
COPY analysis-output ./analysis-output

COPY dashboard/server/docker-entrypoint.sh /usr/local/bin
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]

CMD ["node", "index.js"]