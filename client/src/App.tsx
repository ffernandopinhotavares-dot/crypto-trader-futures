import { useMemo, useState } from "react";
import {
  BarChart3,
  Camera,
  ChartColumn,
  CircleDollarSign,
  ImagePlus,
  MapPin,
  PackageSearch,
  ScanBarcode,
  Search,
  ShieldCheck,
  Store,
} from "lucide-react";
import {
  competitorInsights,
  marketBlueprint,
  productCatalog,
  type PriceSource,
  type ProductEntry,
} from "./data-price-intelligence";

type SearchMode = "nome" | "codigo" | "imagem";

export const trpc = {} as any;

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function resolveProduct(query: string, mode: SearchMode) {
  const normalizedQuery = normalize(query);

  return productCatalog.find((product) => {
    if (mode === "codigo") {
      return product.barcode.includes(normalizedQuery);
    }

    if (mode === "imagem") {
      return [product.name, product.brand, ...product.aliases].some(
        (candidate) =>
          normalizedQuery.includes(normalize(candidate)) ||
          normalize(candidate).includes(normalizedQuery),
      );
    }

    return [
      product.name,
      product.brand,
      product.packaging,
      ...product.aliases,
    ].some((candidate) => normalize(candidate).includes(normalizedQuery));
  });
}

function sourceTypeLabel(sourceKind: PriceSource["sourceKind"]) {
  return {
    marketplace: "Marketplace",
    ecommerce: "E-commerce",
    loja_fisica: "Loja física",
    atacado: "Atacado",
  }[sourceKind];
}

function App() {
  const [searchMode, setSearchMode] = useState<SearchMode>("nome");
  const [searchText, setSearchText] = useState("café 3 corações");
  const [barcode, setBarcode] = useState("7896005800013");
  const [imageHint, setImageHint] = useState("foto do café 3 corações 500g");
  const [uploadedImageName, setUploadedImageName] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<
    ProductEntry | undefined
  >(() => resolveProduct("café 3 corações", "nome"));

  const activeQuery =
    searchMode === "codigo"
      ? barcode
      : searchMode === "imagem"
        ? imageHint
        : searchText;

  const analytics = useMemo(() => {
    if (!selectedProduct) return undefined;

    const allPrices = selectedProduct.sources.map((source) => source.price);
    const cheapest = [...selectedProduct.sources].sort(
      (a, b) => a.price - b.price,
    )[0];
    const priciest = [...selectedProduct.sources].sort(
      (a, b) => b.price - a.price,
    )[0];
    const avgPrice = average(allPrices);
    const medianPrice = median(allPrices);
    const avgShipping = average(
      selectedProduct.sources.map((source) => source.shipping),
    );
    const suggestedResale = avgPrice * 1.11 + avgShipping * 0.35;

    return {
      cheapest,
      priciest,
      avgPrice,
      medianPrice,
      avgShipping,
      suggestedResale,
      spread: priciest.price - cheapest.price,
    };
  }, [selectedProduct]);

  const onlineCount =
    selectedProduct?.sources.filter(
      (source) =>
        source.sourceKind !== "loja_fisica" && source.sourceKind !== "atacado",
    ).length ?? 0;
  const offlineCount = selectedProduct?.sources.length
    ? selectedProduct.sources.length - onlineCount
    : 0;

  function runSearch() {
    const query = activeQuery || searchText || barcode || imageHint;
    const match = resolveProduct(query, searchMode);
    setSelectedProduct(match);
  }

  return (
    <div className="app-shell">
      <section className="hero-card grid-hero">
        <div>
          <span className="eyebrow">price intelligence para revenda</span>
          <h1>
            Plataforma de cotação para descobrir o menor, o médio e o maior
            preço do mercado.
          </h1>
          <p className="hero-copy">
            Monte uma operação de precificação baseada em produto, código de
            barras e imagem, cruzando marketplaces, Google, e-commerces e
            referências de lojas físicas para ter uma base real antes de
            revender.
          </p>

          <div className="hero-actions">
            <button className="primary-button" onClick={runSearch}>
              <Search size={16} />
              Testar busca
            </button>
            <a className="ghost-button" href="#arquitetura">
              <BarChart3 size={16} />
              Ver arquitetura sugerida
            </a>
          </div>

          <div className="hero-metrics">
            <MetricPill
              icon={Store}
              label="Fontes online"
              value="Marketplaces + Google"
            />
            <MetricPill
              icon={MapPin}
              label="Lojas físicas"
              value="Coleta local + encartes"
            />
            <MetricPill
              icon={ShieldCheck}
              label="Uso ideal"
              value="Formação de preço"
            />
          </div>
        </div>

        <div className="hero-panel">
          <div className="panel-badge">MVP sugerido</div>
          <div className="stack-list">
            <StackItem
              icon={PackageSearch}
              title="Entrada flexível"
              description="nome, EAN e imagem do produto"
            />
            <StackItem
              icon={ChartColumn}
              title="Normalização"
              description="unificar embalagem, variações e frete"
            />
            <StackItem
              icon={CircleDollarSign}
              title="Saída acionável"
              description="menor, médio, maior e preço sugerido"
            />
          </div>
        </div>
      </section>

      <section className="content-grid">
        <article className="surface-card search-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">busca guiada</span>
              <h2>Pesquisar por nome, código ou imagem</h2>
            </div>
            <span className="status-chip">MVP navegável</span>
          </div>

          <div className="mode-switcher">
            {[
              { id: "nome", label: "Nome do produto", icon: PackageSearch },
              { id: "codigo", label: "Código de barras", icon: ScanBarcode },
              { id: "imagem", label: "Imagem / foto", icon: Camera },
            ].map((mode) => {
              const Icon = mode.icon;
              const active = searchMode === mode.id;
              return (
                <button
                  key={mode.id}
                  className={active ? "mode-button active" : "mode-button"}
                  onClick={() => setSearchMode(mode.id as SearchMode)}
                >
                  <Icon size={15} />
                  {mode.label}
                </button>
              );
            })}
          </div>

          {searchMode === "nome" && (
            <label className="input-group">
              <span>Nome / marca / embalagem</span>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Ex.: Café 3 Corações 500g"
              />
            </label>
          )}

          {searchMode === "codigo" && (
            <label className="input-group">
              <span>EAN / código de barras</span>
              <input
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="Ex.: 7896005800013"
              />
            </label>
          )}

          {searchMode === "imagem" && (
            <div className="image-inputs">
              <label className="input-group">
                <span>Dica textual da imagem</span>
                <input
                  value={imageHint}
                  onChange={(event) => setImageHint(event.target.value)}
                  placeholder="Ex.: foto do detergente Ypê neutro 500ml"
                />
              </label>

              <label className="upload-box">
                <ImagePlus size={18} />
                <div>
                  <strong>Enviar foto do produto</strong>
                  <p>
                    Nesta primeira versão a imagem entra como apoio visual para
                    o operador. Em produção, você pode conectar OCR, leitura de
                    rótulo ou APIs de busca visual.
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setUploadedImageName(event.target.files?.[0]?.name ?? "")
                  }
                />
              </label>
              {uploadedImageName && (
                <span className="upload-note">
                  Arquivo selecionado: {uploadedImageName}
                </span>
              )}
            </div>
          )}

          <div className="action-row">
            <button className="primary-button full-width" onClick={runSearch}>
              <Search size={16} />
              Pesquisar preços do mercado
            </button>
          </div>

          <div className="helper-box">
            <strong>Como fazer isso funcionar de verdade?</strong>
            <p>
              O fluxo recomendado é: identificar o produto → consultar APIs e
              scrapers permitidos → normalizar oferta equivalente → remover
              outliers → calcular menor, médio e maior → sugerir preço de
              revenda.
            </p>
          </div>
        </article>

        <article className="surface-card result-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">resultado da cotação</span>
              <h2>
                {selectedProduct
                  ? selectedProduct.name
                  : "Nenhum produto encontrado"}
              </h2>
            </div>
            {selectedProduct && (
              <span className="status-chip">EAN {selectedProduct.barcode}</span>
            )}
          </div>

          {selectedProduct && analytics ? (
            <>
              <div className="product-overview">
                <img src={selectedProduct.image} alt={selectedProduct.name} />
                <div>
                  <div className="product-tags">
                    <span>{selectedProduct.brand}</span>
                    <span>{selectedProduct.category}</span>
                    <span>{selectedProduct.packaging}</span>
                  </div>
                  <p>
                    A leitura abaixo mistura referências online e físicas para
                    você entender o piso, o centro do mercado e o teto
                    praticado. Isso ajuda a evitar revender muito barato ou
                    ficar acima da concorrência local.
                  </p>
                </div>
              </div>

              <div className="stats-grid">
                <StatCard
                  title="Menor preço"
                  value={currency(analytics.cheapest.price)}
                  hint={analytics.cheapest.store}
                />
                <StatCard
                  title="Preço médio"
                  value={currency(analytics.avgPrice)}
                  hint="média simples das fontes"
                />
                <StatCard
                  title="Maior preço"
                  value={currency(analytics.priciest.price)}
                  hint={analytics.priciest.store}
                />
                <StatCard
                  title="Preço sugerido"
                  value={currency(analytics.suggestedResale)}
                  hint="média + margem operacional"
                />
              </div>

              <div className="insight-grid">
                <InsightBox
                  label="Amplitude de mercado"
                  value={currency(analytics.spread)}
                />
                <InsightBox
                  label="Mediana"
                  value={currency(analytics.medianPrice)}
                />
                <InsightBox
                  label="Frete médio"
                  value={currency(analytics.avgShipping)}
                />
                <InsightBox
                  label="Cobertura"
                  value={`${onlineCount} online • ${offlineCount} físicas`}
                />
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Fonte</th>
                      <th>Tipo</th>
                      <th>Preço</th>
                      <th>Frete</th>
                      <th>Local</th>
                      <th>Confiança</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProduct.sources
                      .slice()
                      .sort((a, b) => a.price - b.price)
                      .map((source) => (
                        <tr key={`${source.store}-${source.location}`}>
                          <td>
                            <strong>{source.store}</strong>
                            <span>{source.note}</span>
                          </td>
                          <td>{sourceTypeLabel(source.sourceKind)}</td>
                          <td>{currency(source.price)}</td>
                          <td>
                            {source.shipping
                              ? currency(source.shipping)
                              : "Retirada / embutido"}
                          </td>
                          <td>{source.location}</td>
                          <td>{source.confidence}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <PackageSearch size={28} />
              <p>
                Não encontramos esse item no catálogo demonstrativo. Para o
                produto real, o próximo passo é conectar APIs/scrapers e uma
                base própria de cotações físicas.
              </p>
            </div>
          )}
        </article>
      </section>

      <section id="arquitetura" className="surface-card architecture-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">arquitetura sugerida</span>
            <h2>Como transformar o MVP em uma ferramenta operacional</h2>
          </div>
        </div>

        <div className="blueprint-grid">
          {marketBlueprint.map((item) => (
            <div key={item.title} className="mini-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>

        <div className="roadmap-grid">
          <div className="mini-card emphasis">
            <h3>1. Captura online</h3>
            <ul>
              <li>
                Google Shopping / Merchant para catálogo e sinais de preço.
              </li>
              <li>APIs oficiais de marketplaces quando existirem.</li>
              <li>
                Fallback com scraping responsável apenas onde os termos
                permitirem.
              </li>
            </ul>
          </div>

          <div className="mini-card emphasis">
            <h3>2. Captura física</h3>
            <ul>
              <li>
                App interno para promotor/operador registrar preço em campo.
              </li>
              <li>Importação de encartes e tabloides de atacarejos.</li>
              <li>
                Geolocalização por cidade/bairro para comparar contexto local.
              </li>
            </ul>
          </div>

          <div className="mini-card emphasis">
            <h3>3. Regras de precificação</h3>
            <ul>
              <li>Filtrar outliers e promoções não recorrentes.</li>
              <li>
                Separar unitário, kit e atacado para não distorcer a média.
              </li>
              <li>Adicionar taxa, frete, comissão e margem mínima desejada.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="surface-card competitors-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">benchmark de mercado</span>
            <h2>Referências usadas para desenhar a experiência</h2>
          </div>
        </div>

        <div className="competitor-grid">
          {competitorInsights.map((competitor) => (
            <a
              key={competitor.name}
              className="competitor-card"
              href={competitor.link}
              target="_blank"
              rel="noreferrer"
            >
              <h3>{competitor.name}</h3>
              <ul>
                {competitor.takeaways.map((takeaway) => (
                  <li key={takeaway}>{takeaway}</li>
                ))}
              </ul>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Store;
  label: string;
  value: string;
}) {
  return (
    <div className="metric-pill">
      <Icon size={15} />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function StackItem({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Store;
  title: string;
  description: string;
}) {
  return (
    <div className="stack-item">
      <div className="stack-icon">
        <Icon size={16} />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function InsightBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="insight-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
