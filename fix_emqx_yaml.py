with open("/app/docker-compose.yml", "r") as f:
    lines = f.readlines()
with open("/app/docker-compose.yml", "w") as f:
    for l in lines:
        if "ALGORITHM" in l and "EMQX" in l:
            f.write("      EMQX_AUTHENTICATION__1__ALGORITHM: hmac-based\n")
        else:
            f.write(l)
