# Regras de Segurança do Firebase Realtime Database

## Contexto

O projeto `sol-de-soter` usa o Firebase Realtime Database para sincronizar dados do usuário.
A API Key fica exposta no cliente (`js/firebase-config.js`) — isso é **esperado e normal** no Firebase,
mas significa que qualquer pessoa que encontrar a key pode tentar acessar o banco.

A proteção real dos dados vem das **Security Rules**, não da API Key.

---

## Regras Recomendadas

Cole as regras abaixo no console do Firebase:
**Firebase Console → Realtime Database → Rules**

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

### O que essas regras fazem

- **Leitura e escrita** só são permitidas para o usuário autenticado com aquele `uid`.
- Nenhum outro usuário (mesmo autenticado) consegue acessar os dados de outro.
- Requisições sem autenticação (`auth === null`) são **bloqueadas**.

---

## Regras Inseguras — Evite

Nunca deixe as regras em modo aberto (padrão inicial do Firebase):

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

Isso permite que qualquer pessoa leia e escreva no banco sem autenticação.

---

## Como Verificar

1. Abra o [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto `sol-de-soter`
3. Vá em **Realtime Database → Rules**
4. Confirme que as regras restringem acesso por `auth.uid`
5. Use a aba **Rules Playground** para testar:
   - Simule uma requisição sem autenticação → deve retornar `Permission denied`
   - Simule com o uid correto → deve retornar `Allowed`

---

## Checklist de Segurança

- [ ] Security Rules restritas por `auth.uid`
- [ ] Nenhuma regra `.read: true` ou `.write: true` na raiz
- [ ] Autenticação por email/senha habilitada
- [ ] Google Auth e Guest Access desabilitados (conforme `firebase-config.js`)
- [ ] Regras testadas no Rules Playground
