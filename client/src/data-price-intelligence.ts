export type SourceKind =
  | "marketplace"
  | "ecommerce"
  | "loja_fisica"
  | "atacado";

export interface PriceSource {
  store: string;
  price: number;
  shipping: number;
  location: string;
  sourceKind: SourceKind;
  confidence: "Alta" | "Média";
  note: string;
}

export interface ProductEntry {
  id: string;
  name: string;
  barcode: string;
  image: string;
  category: string;
  brand: string;
  aliases: string[];
  packaging: string;
  sources: PriceSource[];
}

export const productCatalog: ProductEntry[] = [
  {
    id: "cafe-3coracoes-500",
    name: "Café Torrado e Moído 3 Corações 500g",
    barcode: "7896005800013",
    image:
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
    category: "Mercearia",
    brand: "3 Corações",
    aliases: ["cafe 3 coracoes", "café 500g", "cafe tradicional"],
    packaging: "Pacote 500g",
    sources: [
      {
        store: "Mercado Livre",
        price: 18.9,
        shipping: 7.99,
        location: "Online",
        sourceKind: "marketplace",
        confidence: "Alta",
        note: "Oferta de seller com reputação alta.",
      },
      {
        store: "Amazon",
        price: 19.8,
        shipping: 0,
        location: "Online",
        sourceKind: "ecommerce",
        confidence: "Alta",
        note: "Entrega Prime e recorrência estável.",
      },
      {
        store: "Atacadão",
        price: 16.99,
        shipping: 0,
        location: "São Paulo - loja física",
        sourceKind: "loja_fisica",
        confidence: "Média",
        note: "Preço de encarte coletado manualmente.",
      },
      {
        store: "Assaí Atacadista",
        price: 16.49,
        shipping: 0,
        location: "Campinas - loja física",
        sourceKind: "atacado",
        confidence: "Média",
        note: "Preço de gôndola para compra unitária.",
      },
      {
        store: "Carrefour",
        price: 21.49,
        shipping: 8.9,
        location: "Online",
        sourceKind: "ecommerce",
        confidence: "Alta",
        note: "Preço sem clube de fidelidade.",
      },
    ],
  },
  {
    id: "oleo-liza-900",
    name: "Óleo de Soja Liza 900ml",
    barcode: "7896036090018",
    image:
      "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=900&q=80",
    category: "Mercearia",
    brand: "Liza",
    aliases: ["oleo liza", "óleo de soja", "oleo 900ml"],
    packaging: "Garrafa 900ml",
    sources: [
      {
        store: "Shopee",
        price: 8.79,
        shipping: 10.5,
        location: "Online",
        sourceKind: "marketplace",
        confidence: "Média",
        note: "Preço agressivo, mas com frete mais alto.",
      },
      {
        store: "Mercado Livre",
        price: 9.5,
        shipping: 6.99,
        location: "Online",
        sourceKind: "marketplace",
        confidence: "Alta",
        note: "Bom volume de vendas e nota do seller acima de 4.7.",
      },
      {
        store: "Roldão Atacadista",
        price: 7.69,
        shipping: 0,
        location: "Guarulhos - loja física",
        sourceKind: "atacado",
        confidence: "Média",
        note: "Preço spot de loja física.",
      },
      {
        store: "Pão de Açúcar",
        price: 10.99,
        shipping: 9.9,
        location: "Online",
        sourceKind: "ecommerce",
        confidence: "Alta",
        note: "Preço premium para conveniência.",
      },
      {
        store: "Mercadinho do Bairro",
        price: 11.5,
        shipping: 0,
        location: "Osasco - loja física",
        sourceKind: "loja_fisica",
        confidence: "Média",
        note: "Preço observado presencialmente pelo revendedor.",
      },
    ],
  },
  {
    id: "detergente-ype-500",
    name: "Detergente Líquido Ypê Neutro 500ml",
    barcode: "7896098900102",
    image:
      "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=900&q=80",
    category: "Limpeza",
    brand: "Ypê",
    aliases: ["detergente ype", "ype neutro", "detergente 500ml"],
    packaging: "Frasco 500ml",
    sources: [
      {
        store: "Magalu",
        price: 3.19,
        shipping: 11.4,
        location: "Online",
        sourceKind: "ecommerce",
        confidence: "Alta",
        note: "Melhor em compras combinadas.",
      },
      {
        store: "Mercado Livre",
        price: 2.99,
        shipping: 8.99,
        location: "Online",
        sourceKind: "marketplace",
        confidence: "Alta",
        note: "Seller com kit promocional.",
      },
      {
        store: "Atacadão",
        price: 2.39,
        shipping: 0,
        location: "São Paulo - loja física",
        sourceKind: "atacado",
        confidence: "Média",
        note: "Preço físico usado como referência de piso.",
      },
      {
        store: "Carrefour Bairro",
        price: 3.89,
        shipping: 0,
        location: "Santo André - loja física",
        sourceKind: "loja_fisica",
        confidence: "Média",
        note: "Preço de conveniência em bairro.",
      },
      {
        store: "Amazon",
        price: 4.29,
        shipping: 0,
        location: "Online",
        sourceKind: "ecommerce",
        confidence: "Alta",
        note: "Bom para reposição rápida.",
      },
    ],
  },
];

export const marketBlueprint = [
  {
    title: "Coleta omnichannel",
    description:
      "Cruze marketplaces, e-commerces, atacarejos, encartes e preços digitados manualmente em campo para montar uma visão realmente útil para revenda.",
  },
  {
    title: "Identificação do item",
    description:
      "Aceite nome, EAN/código de barras, imagem e marca para reduzir ambiguidades entre tamanhos, fragrâncias e embalagens parecidas.",
  },
  {
    title: "Precificação assistida",
    description:
      "Além do menor, médio e maior preço, gere preço sugerido considerando taxa de marketplace, frete médio e margem alvo.",
  },
];

export const competitorInsights = [
  {
    name: "Buscapé",
    takeaways: [
      "comparação entre várias lojas",
      "histórico de preços",
      "cashback/cupons como contexto comercial",
    ],
    link: "https://www.buscape.com.br/",
  },
  {
    name: "Zoom",
    takeaways: [
      "alerta de preço",
      "gráfico histórico",
      "sinalização de menor preço e lojas confiáveis",
    ],
    link: "https://www.zoom.com.br/conheca-o-zoom",
  },
  {
    name: "Google Shopping / Merchant",
    takeaways: [
      "forte cobertura de catálogo",
      "busca por imagem",
      "camada local via inventário de lojas",
    ],
    link: "https://support.google.com/merchants/",
  },
];
