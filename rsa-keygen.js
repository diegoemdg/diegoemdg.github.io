(() => {
  const generator = document.querySelector("[data-rsa-generator]");

  if (!generator) {
    return;
  }

  const form = generator.querySelector("[data-key-form]");
  const ownerInput = generator.querySelector("#key-owner");
  const publicOutput = generator.querySelector("#generated-public-key");
  const privateOutput = generator.querySelector("#generated-private-key");
  const status = generator.querySelector("[data-key-status]");
  const actionButtons = generator.querySelectorAll("[data-key-action]");
  const generateButton = form.querySelector("button[type='submit']");

  let currentPublicPem = "";
  let currentPrivatePem = "";
  let currentOwner = "";

  const setStatus = (message, type = "idle") => {
    status.textContent = message;
    status.dataset.status = type;
  };

  const setActionsEnabled = (enabled) => {
    actionButtons.forEach((button) => {
      button.disabled = !enabled;
    });
  };

  const setBusy = (busy) => {
    generateButton.disabled = busy;
    generateButton.textContent = busy ? "Generando..." : "Generar llave";
  };

  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }

    return window.btoa(binary);
  };

  const wrapBase64 = (base64) => base64.match(/.{1,64}/g).join("\n");

  const toPem = (buffer, label) => {
    const base64 = wrapBase64(arrayBufferToBase64(buffer));
    return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`;
  };

  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.left = "-9999px";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  };

  const downloadPem = (filename, text) => {
    const blob = new Blob([text], { type: "application/x-pem-file;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!window.crypto?.subtle) {
      setStatus("Tu navegador no permite generar llaves Web Crypto en esta pagina.", "error");
      return;
    }

    setBusy(true);
    setActionsEnabled(false);
    setStatus("Generando par de llaves RSA-2048...");
    publicOutput.value = "";
    privateOutput.value = "";

    try {
      const keyPair = await crypto.subtle.generateKey(
        {
          name: "RSA-OAEP",
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: "SHA-256",
        },
        true,
        ["encrypt", "decrypt"],
      );

      const [publicBuffer, privateBuffer] = await Promise.all([
        crypto.subtle.exportKey("spki", keyPair.publicKey),
        crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
      ]);

      currentOwner = ownerInput.value.trim() || "Diego Emilio";
      currentPublicPem = toPem(publicBuffer, "PUBLIC KEY");
      currentPrivatePem = toPem(privateBuffer, "PRIVATE KEY");

      publicOutput.value = currentPublicPem;
      privateOutput.value = currentPrivatePem;
      setActionsEnabled(true);
      setStatus(`Llave publica generada para ${currentOwner}.`, "success");
    } catch (error) {
      console.error(error);
      setStatus("No se pudo generar la llave. Intenta de nuevo en HTTPS o localhost.", "error");
    } finally {
      setBusy(false);
    }
  });

  generator.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-key-action]");

    if (!button || button.disabled) {
      return;
    }

    try {
      if (button.dataset.keyAction === "copy-public") {
        await copyText(currentPublicPem);
        setStatus("Llave publica copiada al portapapeles.", "success");
      }

      if (button.dataset.keyAction === "copy-private") {
        await copyText(currentPrivatePem);
        setStatus("Llave privada copiada al portapapeles.", "success");
      }

      if (button.dataset.keyAction === "download-public") {
        downloadPem(`${currentOwner || "diego"}-publica.pem`, currentPublicPem);
        setStatus("Descarga de llave publica iniciada.", "success");
      }

      if (button.dataset.keyAction === "download-private") {
        downloadPem(`${currentOwner || "diego"}-privada.pem`, currentPrivatePem);
        setStatus("Descarga de llave privada iniciada.", "success");
      }
    } catch (error) {
      console.error(error);
      setStatus("No se pudo completar la accion solicitada.", "error");
    }
  });
})();
