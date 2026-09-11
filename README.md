# Atlas Studio

Editor de mapas interativos a partir de imagens. Permite adicionar pontos, linhas e regiões, vincular registros de planilhas e criar conexões entre mapas. O conteúdo é organizado em projetos.

O aplicativo usa HTML, CSS e JavaScript, com Leaflet para o mapa, SheetJS para planilhas e IndexedDB para armazenamento local. Não exige servidor de aplicação nem etapa de compilação.

## Executar

Com Python 3 instalado, execute na pasta do projeto:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Abra [Atlas Studio](http://127.0.0.1:4173/index.html) em um navegador atualizado. O carregamento das bibliotecas e fontes externas requer internet. Também é possível servir os arquivos com outro servidor HTTP estático.

## Armazenamento

Os projetos ficam no navegador e perfil usados para abrir o aplicativo. Não há sincronização em nuvem. Use **Exportar projeto** para guardar um backup `.atlasproject` e **Importar projeto** para abri-lo em outro navegador ou endereço.

A página de Administração permite cadastrar usuários e políticas locais, mas essas políticas ainda não restringem o acesso ao editor.

## Documentação

- [Guia de uso](docs/user-guide.md): criação, edição, consulta e backups.
- [Guia técnico](docs/development.md): estrutura do código, regras de manutenção e testes.
# atlastudio
