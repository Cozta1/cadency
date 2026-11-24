# Cadency

Loja virtual acadêmica de motos fictícias. Trabalho Final de Comércio Eletrônico, UniAcademia, Prof. Marcos Miguel. Grupo 11.

Site estático (HTML, CSS e JavaScript), sem backend. Carrinho, pedidos e e-mails de teste ficam no navegador (localStorage). Pagamentos em modo de teste: nenhuma cobrança real.

## Rodar localmente

```
python3 -m http.server 8000
```

Abrir http://localhost:8000

## Publicar no GitHub Pages

Settings > Pages > Source: Deploy from a branch > Branch: main, pasta / (root) > Save.

## Dados de teste

- Cartão aprovado: 4242 4242 4242 4242 ou 5555 5555 5555 4444 (validade futura, qualquer CVV)
- Cartão recusado: 4000 0000 0000 0002
- Pix: botão "Simular pagamento recebido" na página do pedido
- Painel do lojista (#/lojista): senha `cadency2026` e código 2FA de um app autenticador com a chave `JBSWY3DPEHPK3PXPCADENCIA`

## Estrutura

- `index.html`: página única
- `assets/data.js`: catálogo, dados da empresa, tabela de frete e regras de pagamento e antifraude
- `assets/app.js`: rotas, catálogo, busca, carrinho, checkout, pagamento, antifraude, e-mails, LGPD e painel
- `assets/moto-svg.js`: ilustrações provisórias das motos
- `assets/totp.js`: 2FA (TOTP) do painel
- `assets/style.css`: estilos
