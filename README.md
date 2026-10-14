# KOBB Atlas

Software Windows para estudos de sol, vento e entorno. Código em `softwares/kobb-atlas`; instalação em `products/kobb-atlas`. Uso gratuito e não comercial.

## Uso

Extraia o ZIP inteiro e abra `kobb-atlas-setup-0.1.10.exe`. Mantenha `product.json` e `payload` ao lado do instalador. Requer Windows 64 bits, [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) e internet. O Windows solicita permissão administrativa para instalar em `C:\Program Files\KOBB\Atlas\0.1.10`. É possível editar a pasta base. A instalação adiciona o Atlas ao menu Iniciar e aos Aplicativos instalados do Windows, com desinstalador próprio. Área de trabalho e barra de tarefas são opcionais; a fixação depende da disponibilidade da ação do Windows. Na conclusão, escolha se deseja abrir o Atlas e a página de agradecimento. O software abre no contexto da área de trabalho, sem manter a elevação do instalador.

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

A vers?o 0.1.10 re?ne os gr?ficos de sol e vento e o controle de hor?rio na sidebar, sem barra inferior. O empacotamento reutiliza o ?cone preparado do Atlas, sem executar o instalador para ger?-lo.

O pacote ainda n?o possui assinatura Authenticode. O SmartScreen pode mostrar ?O Windows protegeu o computador?. A distribui??o com editor verificado exige certificado de assinatura de c?digo confi?vel; a assinatura n?o garante reputa??o imediata no SmartScreen.

A sidebar usa espa?amento de 48 px entre os blocos, sem divisores. A esta??o aparece somente no seletor.

?rbita do mapa: arraste com o bot?o direito, Ctrl + bot?o esquerdo ou a roda pressionada para girar e inclinar em torno do ponto do terreno selecionado. O ponto fica no centro durante a ?rbita; arrastar com o bot?o esquerdo desloca o mapa e rolar a roda ajusta o zoom.

O campo C?rculo (raio km) aceita de 0,02 a 1.000 km. O raio ? convertido em metros internamente e inclu?do na exporta??o. Ao alterar o raio, o mapa ajusta o zoom para mostrar o c?rculo. O limite do entorno cadastral permanece em 1 km.

Campos v?lidos atualizam o estudo durante a edi??o, ap?s 120 ms de pausa, incluindo coordenadas, altitude, hor?rio e raios. N?o h? bot?o de atualiza??o manual. A legenda de usos fica no topo do mapa.

A versão 0.1.10 aceita coordenadas e altitude com precisão fracionada, inclusive valores retornados pelo mapa e pelos serviços, para manter o desenho ambiental durante a atualização automática.

A rosa dos ventos substitui o botão Norte. Suas oito direções acompanham o azimute e a inclinação da câmera, com projeção em perspectiva no modo 3D e plana no modo 2D. O destaque aponta para o norte geográfico.

A rosa dos ventos fica no canto superior direito, sem fundo ou moldura. A legenda de usos e o painel de detalhes mantêm espaço para a rosa.

A versão 0.1.10 inclui filtros de transporte, templos, instituições, comércios e outros pontos, com controle para ocultar tudo. Os filtros usam as categorias do cadastro cartográfico e também se aplicam aos marcadores do entorno. Ruas e nomes de cidades permanecem como referência.

O mapa Satélite usa Esri World Imagery (Esri, Vantor, Earthstar Geographics e GIS User Community), com atribuição visível no mapa. As imagens dependem da cobertura e disponibilidade do provedor; não são imagens em tempo real. Fonte: https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer .

O modo Leve inicia sem relevo ou volumes 3D, em resolução de renderização reduzida. Relevo, volumes e qualidade detalhada podem ser ativados separadamente. A órbita agrupa movimentos por quadro, a rosa reutiliza os elementos SVG e a trajetória solar evita reprojeções de quadros idênticos. A curva exibida usa amostras gráficas de 15 minutos, mantendo os horários inteiros e transições do horizonte; cálculos e exportações mantêm as amostras de cinco minutos.

O botão da janela normal mostra um quadrado simples; na janela maximizada, mostra restaurar. O clique não adiciona bordas de foco nos botões da barra da janela; o foco por teclado permanece disponível.

O cabeçalho indica dia, crepúsculos e noite com ícones astronômicos de sol e lua. A descrição fica no tooltip e no nome acessível; os ícones não representam nebulosidade meteorológica.

O indicador 2D/3D acompanha a inclinação real da câmera, inclusive na órbita com o mouse. Os horários da trajetória solar procuram posições livres no mapa e usam linhas-guia quando deslocados; horários sem espaço na tela ficam ocultos até ampliar ou girar o mapa.
