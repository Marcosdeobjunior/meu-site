# Firebase Setup — versão com autenticação por usuário e coleções separadas

Esta versão do site usa:
- **Firebase Authentication**
- **Cloud Firestore**
- **coleções separadas por usuário**

## Estrutura no Firestore

Cada usuário autenticado salva os dados dentro de:

```text
users/{uid}/
```

Subcoleções criadas automaticamente:

```text
users/{uid}/planejamento/state
users/{uid}/sonhos/state
users/{uid}/livraria/state
users/{uid}/cinema/state
users/{uid}/mangas/state
users/{uid}/revisao/state
users/{uid}/viagens/state
users/{uid}/wishlist/state
users/{uid}/financas/state
users/{uid}/academia/state
users/{uid}/rpg/state
users/{uid}/sistema/state
users/{uid}/perfil/state
```

## 1) Criar projeto

No Firebase Console:
- crie um projeto
- adicione um **Web App**
- copie as credenciais

## 2) Ativar Authentication

No menu **Authentication**:
- clique em **Get started**
- ative **Email/Password**
- opcional: ative **Google** se quiser login com Google

## 3) Ativar Firestore Database

No menu **Firestore Database**:
- clique em **Create database**
- escolha modo **Production** ou **Test**
- selecione a região

## 4) Editar o arquivo de configuração

Abra:

```js
js/firebase-config.js
```

Preencha os campos `CHANGE_ME`.

Exemplo:

```js
window.SOTER_FIREBASE_CONFIG = {
  apiKey: "SUA_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
  appName: "soter-app",
  userCollection: "users",
  auth: {
    enabled: true,
    emailPassword: true,
    google: false,
    allowGuest: false
  }
};
```

Se quiser login com Google:
- ative o provider no Firebase Console
- troque `google: false` para `google: true`

## 5) Regras sugeridas do Firestore

Use regras parecidas com estas:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

## 6) Como usar no site

No menu de perfil, agora existe a área **Conta Firebase**.

Você pode:
- entrar com email e senha
- criar conta
- sair
- sincronizar manualmente

Sem login:
- o site continua funcionando com armazenamento local

Com login:
- os dados passam a ser separados por usuário
- cada coleção é salva no Firestore individualmente
- a sincronização em tempo real é ativada

## Observações

- Se o usuário entrar pela primeira vez e não tiver dados no Firestore, o site envia o estado local atual.
- Se já existirem dados remotos, o site carrega os dados do usuário autenticado.
- A foto de perfil e o nome também são salvos por usuário.


## Mapeamento desta versão

As páginas com banco de dados separado nesta versão são:

- `livros.html` → coleção `livraria`
- `cinema.html` → coleção `cinema`
- `mangas.html` → coleção `mangas`
- `revisao.html` → coleção `revisao`
- `sonhos.html` → coleção `sonhos`
- `viagens.html` → coleção `viagens`
- `wishlist.html` → coleção `wishlist`
- `financas.html` → coleção `financas`
- `tarefas.html` → coleção `planejamento`
- `academia.html` → coleção `academia`
- `rpg.html` → coleção `rpg`

A coleção `sistema` continua existindo apenas para metadados internos do site, como status de sincronização, notificações e preferências gerais.
