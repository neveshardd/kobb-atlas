# KOBB Atlas

Software Windows para estudos de sol, vento e entorno. Código em `softwares/kobb-atlas`; instalação em `products/kobb-atlas`. Uso gratuito e não comercial.

## Uso

Extraia o ZIP inteiro e abra `kobb-atlas-setup-0.1.2.exe`. Mantenha `product.json` e `payload` ao lado do instalador. Requer Windows 64 bits, [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) e internet. O Windows solicita permissão administrativa para instalar em `C:\Program Files\KOBB\Atlas\0.1.2`. É possível editar a pasta base. A instalação adiciona o Atlas ao menu Iniciar e aos Aplicativos instalados do Windows, com desinstalador próprio. Área de trabalho e barra de tarefas são opcionais; a fixação depende da disponibilidade da ação do Windows. Na conclusão, escolha se deseja abrir o Atlas e a página de agradecimento. O software abre no contexto da área de trabalho, sem manter a elevação do instalador.

Busque uma cidade, clique no mapa ou informe as coordenadas. Ajuste data, hora e fuso. Os atalhos Manhã, Dia e Noite usam nascer do sol, meio-dia solar e início da noite astronômica. As estações correspondem aos eventos reais no hemisfério escolhido. A carta solar e as setas permanecem alinhadas ao norte geográfico, inclusive com o mapa girado.

O raio do diagrama é uma escala gráfica sobre o terreno. A rosa diária representa as direções de origem do vento; a seta aponta para o destino. A exportação JSON inclui coordenadas, unidades, horários, fontes, natureza dos dados e resultados disponíveis.

A seta continua visível com vento calmo quando o modelo informa direção. Ela representa orientação, não intensidade; velocidades baixas ou nulas podem ter direção instável ou apenas a convenção numérica do modelo. Sem direção informada, não é desenhada uma seta inventada.

## Fontes e limites

- [Astronomy Engine](https://github.com/cosinekitty/astronomy): posição topocêntrica e refração padrão. Trajetória solar 3D em hemisfério sobre o ponto, com horários locais e amostras a cada cinco minutos. Carta estereográfica no painel 2D. Caso de referência [NREL SPA](https://www.nrel.gov/docs/fy08osti/34302.pdf) validado com tolerância de 0,02°. A atmosfera real e obstruções locais podem mudar a observação.
- [Open-Meteo](https://open-meteo.com/en/docs): vento a 10 m e temperatura a 2 m, de modelos regionais. Datas históricas usam [ERA5](https://open-meteo.com/en/docs/historical-weather-api), disponível desde 1940 e sujeito a atraso. Valores são horários; o horário efetivo aparece na interface e na exportação. Dados ausentes não viram zero. A rosa é diária, não uma normal climatológica anual.
- [Open-Meteo Elevation](https://open-meteo.com/en/docs/elevation-api): altitude inicial Copernicus GLO-90 ou geocodificação. Confirme a altitude para estudos precisos; se a consulta falhar, informe-a. Relevo de consulta não substitui levantamento.
- [OpenFreeMap](https://openfreemap.org/), [OpenStreetMap](https://www.openstreetmap.org/copyright) e [Mapterhorn](https://mapterhorn.com/attribution/): mapa e terreno 3D global de aproximadamente 30 m, sem exagero vertical. Volumes cartográficos opcionais podem ter alturas estimadas. Ícones de vento ficam no perímetro do círculo no terreno; a trajetória solar mantém azimute e altitude em 3D. O raio é uma escala de representação. As camadas não simulam oclusão, sombras dos edifícios ou escoamento do vento entre volumes.
- [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API): usos cadastrados em um raio de até 1 km. Indústrias, templos e locais de eventos são fontes potenciais; escolas e serviços de saúde são receptores sensíveis. Os pontos podem representar o centro cartográfico de uma edificação ou área. Cadastro e atividade não são verificados em campo. Não há medição, estimativa de decibéis ou propagação acústica.

Incidência é o ângulo entre o raio solar e a normal do plano. Sombra corresponde a um elemento vertical sobre plano horizontal sem obstruções. Não são emitidas avaliações de desempenho térmico, vento estrutural ou conformidade acústica: NBR 15220/15575, NBR 6123 e NBR 10151/10152 exigem os dados e procedimentos específicos de projeto e medição.

## Dados e licenças

Consultas enviam coordenadas ou cidade aos respectivos provedores. Preferências e perfil WebView2 ficam no computador; exportações são salvas no local escolhido. Não há conta nem telemetria KOBB. Serviços gratuitos dependem de disponibilidade e limites dos provedores. O endpoint gratuito Open-Meteo exige [uso não comercial](https://open-meteo.com/en/pricing); os dados meteorológicos requerem atribuição [CC BY 4.0](https://open-meteo.com/en/terms).

Atribuições cartográficas permanecem no mapa. Dados OpenStreetMap: ODbL. MapLibre GL JS: BSD-3-Clause. Astronomy Engine, GeographicLib, Temporal Polyfill e tz-lookup: MIT. WebView2: licença Microsoft. Os avisos integrais das dependências estão em `THIRD-PARTY-NOTICES.txt`, incluído no pacote.

## Desenvolvimento

Node 24, .NET 10 e Microsoft Edge para os testes de interface.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run test:ui
npm.cmd run build
dotnet build src/Kobb.Atlas -c Release
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/Package.ps1
```

O empacotamento verifica os cálculos e instala/remove o pacote completo em pasta temporária, testando o atalho real do Windows e a preservação de estudos. Os testes de interface incluem o mapa real e falhas dos serviços externos.

Regras: SOLID; separar cálculos, serviços e apresentação; não inventar dados; textos essenciais; controles estáveis e acessíveis; sem comentários ou documentação no código. Documentação somente no README.

© 2026 KOBB. Todos os direitos reservados. [kobbstudio.com.br](https://kobbstudio.com.br)

Os ícones de vento usam 1 símbolo abaixo de 3,4 m/s, 2 de 3,4 até menos de 10,8 m/s e 3 a partir de 10,8 m/s. Agrupamento visual das faixas Beaufort 0–2, 3–5 e 6+, conforme [Met Office](https://metoffice.github.io/CSET/reference/operators.html). Vento calmo mantém a direção informada pela fonte. Cálculos solares diários rodam em worker separado; a seleção do terreno preserva a câmera.
