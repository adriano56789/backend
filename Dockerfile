# Multi-stage build: nginx from source
FROM ubuntu:22.04 AS builder

RUN apt-get update && apt-get install -y \
    build-essential \
    libpcre3-dev \
    libssl-dev \
    zlib1g-dev \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . /src/nginx

WORKDIR /src/nginx
RUN auto/configure \
    --with-http_ssl_module \
    --with-http_v2_module \
    --with-http_realip_module \
    --with-http_stub_status_module \
    --with-http_gzip_static_module \
    --with-pcre \
    --with-http_sub_module \
    --with-stream \
    --with-stream_ssl_module \
    --with-http_addition_module

RUN make -j$(nproc) && make install

# Stage 2: runtime
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libpcre3 \
    libssl3 \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/nginx /usr/local/nginx

COPY nginx.conf /usr/local/nginx/conf/nginx.conf

RUN mkdir -p /usr/local/nginx/html

EXPOSE 80 443

STOPSIGNAL SIGQUIT

CMD ["/usr/local/nginx/sbin/nginx", "-g", "daemon off;"]
