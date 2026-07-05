export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      campanha_itens: {
        Row: {
          campanha_id: string
          codigo_produto: string | null
          created_at: string
          desconto_pct: number | null
          id: string
          preco_promocional: number | null
          produto_id: string | null
        }
        Insert: {
          campanha_id: string
          codigo_produto?: string | null
          created_at?: string
          desconto_pct?: number | null
          id?: string
          preco_promocional?: number | null
          produto_id?: string | null
        }
        Update: {
          campanha_id?: string
          codigo_produto?: string | null
          created_at?: string
          desconto_pct?: number | null
          id?: string
          preco_promocional?: number | null
          produto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campanha_itens_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanha_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          created_at: string
          created_by: string | null
          data_fim: string
          data_inicio: string
          descricao: string | null
          id: string
          nome: string
          status: Database["public"]["Enums"]["campanha_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_fim: string
          data_inicio: string
          descricao?: string | null
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["campanha_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["campanha_status"]
          updated_at?: string
        }
        Relationships: []
      }
      carteira_movimentacoes: {
        Row: {
          alterado_por: string | null
          created_at: string
          especificador_id: string
          id: string
          loja_id: string | null
          motivo: string | null
          observacao: string | null
          status_anterior: Database["public"]["Enums"]["carteira_status"] | null
          status_novo: Database["public"]["Enums"]["carteira_status"] | null
          tipo: Database["public"]["Enums"]["carteira_mov_tipo"]
          vendedor_anterior_id: string | null
          vendedor_novo_id: string | null
        }
        Insert: {
          alterado_por?: string | null
          created_at?: string
          especificador_id: string
          id?: string
          loja_id?: string | null
          motivo?: string | null
          observacao?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["carteira_status"]
            | null
          status_novo?: Database["public"]["Enums"]["carteira_status"] | null
          tipo: Database["public"]["Enums"]["carteira_mov_tipo"]
          vendedor_anterior_id?: string | null
          vendedor_novo_id?: string | null
        }
        Update: {
          alterado_por?: string | null
          created_at?: string
          especificador_id?: string
          id?: string
          loja_id?: string | null
          motivo?: string | null
          observacao?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["carteira_status"]
            | null
          status_novo?: Database["public"]["Enums"]["carteira_status"] | null
          tipo?: Database["public"]["Enums"]["carteira_mov_tipo"]
          vendedor_anterior_id?: string | null
          vendedor_novo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carteira_movimentacoes_especificador_id_fkey"
            columns: ["especificador_id"]
            isOneToOne: false
            referencedRelation: "especificadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carteira_movimentacoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carteira_movimentacoes_vendedor_anterior_id_fkey"
            columns: ["vendedor_anterior_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carteira_movimentacoes_vendedor_novo_id_fkey"
            columns: ["vendedor_novo_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_audit_log: {
        Row: {
          block_reason: string | null
          blocked: boolean
          created_at: string
          id: string
          intent: string | null
          prompt_preview: string | null
          role_snapshot: string | null
          scope_snapshot: Json | null
          tables_consulted: string[]
          user_id: string
        }
        Insert: {
          block_reason?: string | null
          blocked?: boolean
          created_at?: string
          id?: string
          intent?: string | null
          prompt_preview?: string | null
          role_snapshot?: string | null
          scope_snapshot?: Json | null
          tables_consulted?: string[]
          user_id: string
        }
        Update: {
          block_reason?: string | null
          blocked?: boolean
          created_at?: string
          id?: string
          intent?: string | null
          prompt_preview?: string | null
          role_snapshot?: string | null
          scope_snapshot?: Json | null
          tables_consulted?: string[]
          user_id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean
          cidade: string | null
          created_at: string
          documento: string | null
          email: string | null
          id: string
          nome: string
          telefone: string | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      coordenadores: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          loja_id: string | null
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          loja_id?: string | null
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          loja_id?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coordenadores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      especificadores: {
        Row: {
          ativo: boolean
          cidade: string | null
          created_at: string
          data_status_alterado: string | null
          documento: string | null
          email: string | null
          id: string
          loja_responsavel_id: string | null
          motivo_status: string | null
          nome: string
          observacoes: string | null
          profissao: string | null
          status_carteira: Database["public"]["Enums"]["carteira_status"]
          telefone: string | null
          uf: string | null
          updated_at: string
          vendedor_responsavel_id: string | null
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          data_status_alterado?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          loja_responsavel_id?: string | null
          motivo_status?: string | null
          nome: string
          observacoes?: string | null
          profissao?: string | null
          status_carteira?: Database["public"]["Enums"]["carteira_status"]
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          vendedor_responsavel_id?: string | null
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          data_status_alterado?: string | null
          documento?: string | null
          email?: string | null
          id?: string
          loja_responsavel_id?: string | null
          motivo_status?: string | null
          nome?: string
          observacoes?: string | null
          profissao?: string | null
          status_carteira?: Database["public"]["Enums"]["carteira_status"]
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          vendedor_responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "especificadores_loja_responsavel_id_fkey"
            columns: ["loja_responsavel_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "especificadores_vendedor_responsavel_id_fkey"
            columns: ["vendedor_responsavel_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      especificadores_alertas: {
        Row: {
          created_at: string
          detalhe: string | null
          especificador_id: string
          id: string
          loja_id: string | null
          metrica: number | null
          periodo_fim: string | null
          periodo_inicio: string | null
          resolved_at: string | null
          severidade: string
          status: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          detalhe?: string | null
          especificador_id: string
          id?: string
          loja_id?: string | null
          metrica?: number | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          resolved_at?: string | null
          severidade?: string
          status?: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          detalhe?: string | null
          especificador_id?: string
          id?: string
          loja_id?: string | null
          metrica?: number | null
          periodo_fim?: string | null
          periodo_inicio?: string | null
          resolved_at?: string | null
          severidade?: string
          status?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "especificadores_alertas_especificador_id_fkey"
            columns: ["especificador_id"]
            isOneToOne: false
            referencedRelation: "especificadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "especificadores_alertas_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_participantes: {
        Row: {
          cliente_id: string | null
          created_at: string
          especificador_id: string | null
          evento_id: string
          id: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          especificador_id?: string | null
          evento_id: string
          id?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          especificador_id?: string | null
          evento_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_participantes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_participantes_especificador_id_fkey"
            columns: ["especificador_id"]
            isOneToOne: false
            referencedRelation: "especificadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_participantes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          created_at: string
          data_evento: string
          id: string
          investimento: number
          loja_id: string | null
          nome: string
          observacao: string | null
          responsavel_id: string | null
          tipo: Database["public"]["Enums"]["evento_tipo"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_evento: string
          id?: string
          investimento?: number
          loja_id?: string | null
          nome: string
          observacao?: string | null
          responsavel_id?: string | null
          tipo?: Database["public"]["Enums"]["evento_tipo"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_evento?: string
          id?: string
          investimento?: number
          loja_id?: string | null
          nome?: string
          observacao?: string | null
          responsavel_id?: string | null
          tipo?: Database["public"]["Enums"]["evento_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      forecasts: {
        Row: {
          created_at: string
          escopo: string
          escopo_id: string | null
          gerado_em: string
          gerado_por: string | null
          horizonte_meses: number
          id: string
          mape: number | null
          metodo: string
          observacao: string | null
          resultado: Json
        }
        Insert: {
          created_at?: string
          escopo?: string
          escopo_id?: string | null
          gerado_em?: string
          gerado_por?: string | null
          horizonte_meses?: number
          id?: string
          mape?: number | null
          metodo?: string
          observacao?: string | null
          resultado: Json
        }
        Update: {
          created_at?: string
          escopo?: string
          escopo_id?: string | null
          gerado_em?: string
          gerado_por?: string | null
          horizonte_meses?: number
          id?: string
          mape?: number | null
          metodo?: string
          observacao?: string | null
          resultado?: Json
        }
        Relationships: []
      }
      gerentes: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          escopo: Database["public"]["Enums"]["escopo_gerente"]
          id: string
          loja_id: string | null
          nome: string
          regiao_id: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          escopo?: Database["public"]["Enums"]["escopo_gerente"]
          id?: string
          loja_id?: string | null
          nome: string
          regiao_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          escopo?: Database["public"]["Enums"]["escopo_gerente"]
          id?: string
          loja_id?: string | null
          nome?: string
          regiao_id?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gerentes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gerentes_regiao_id_fkey"
            columns: ["regiao_id"]
            isOneToOne: false
            referencedRelation: "regioes"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          arquivo: string
          cadastros_criados: Json
          created_at: string
          erros: Json
          id: string
          tipo: string
          total_erro: number
          total_linhas: number
          total_sucesso: number
          user_id: string | null
        }
        Insert: {
          arquivo: string
          cadastros_criados?: Json
          created_at?: string
          erros?: Json
          id?: string
          tipo: string
          total_erro?: number
          total_linhas?: number
          total_sucesso?: number
          user_id?: string | null
        }
        Update: {
          arquivo?: string
          cadastros_criados?: Json
          created_at?: string
          erros?: Json
          id?: string
          tipo?: string
          total_erro?: number
          total_linhas?: number
          total_sucesso?: number
          user_id?: string | null
        }
        Relationships: []
      }
      interacoes: {
        Row: {
          created_at: string
          data_interacao: string
          especificador_id: string
          id: string
          loja_id: string | null
          observacao: string | null
          owner_id: string | null
          proxima_acao: string | null
          proxima_data: string | null
          tipo: Database["public"]["Enums"]["interacao_tipo"]
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          created_at?: string
          data_interacao?: string
          especificador_id: string
          id?: string
          loja_id?: string | null
          observacao?: string | null
          owner_id?: string | null
          proxima_acao?: string | null
          proxima_data?: string | null
          tipo: Database["public"]["Enums"]["interacao_tipo"]
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          created_at?: string
          data_interacao?: string
          especificador_id?: string
          id?: string
          loja_id?: string | null
          observacao?: string | null
          owner_id?: string | null
          proxima_acao?: string | null
          proxima_data?: string | null
          tipo?: Database["public"]["Enums"]["interacao_tipo"]
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interacoes_especificador_id_fkey"
            columns: ["especificador_id"]
            isOneToOne: false
            referencedRelation: "especificadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacoes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interacoes_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          ativo: boolean
          canal: Database["public"]["Enums"]["canal_tipo"]
          cidade: string | null
          codigo: string
          created_at: string
          id: string
          nome: string
          regiao_id: string | null
          tipo: Database["public"]["Enums"]["loja_tipo"]
          uf: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal: Database["public"]["Enums"]["canal_tipo"]
          cidade?: string | null
          codigo: string
          created_at?: string
          id?: string
          nome: string
          regiao_id?: string | null
          tipo?: Database["public"]["Enums"]["loja_tipo"]
          uf?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal?: Database["public"]["Enums"]["canal_tipo"]
          cidade?: string | null
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          regiao_id?: string | null
          tipo?: Database["public"]["Enums"]["loja_tipo"]
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lojas_regiao_id_fkey"
            columns: ["regiao_id"]
            isOneToOne: false
            referencedRelation: "regioes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string | null
          origem: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          origem?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string | null
          origem?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      novidades: {
        Row: {
          created_at: string
          descricao: string
          id: string
          link: string | null
          modulo: string | null
          perfis: string[]
          publicado_em: string
          regra_alterada: string | null
          tipo: Database["public"]["Enums"]["novidade_tipo"]
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          link?: string | null
          modulo?: string | null
          perfis?: string[]
          publicado_em?: string
          regra_alterada?: string | null
          tipo?: Database["public"]["Enums"]["novidade_tipo"]
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          link?: string | null
          modulo?: string | null
          perfis?: string[]
          publicado_em?: string
          regra_alterada?: string | null
          tipo?: Database["public"]["Enums"]["novidade_tipo"]
          titulo?: string
        }
        Relationships: []
      }
      novidades_leituras: {
        Row: {
          id: string
          lido_em: string
          novidade_id: string
          user_id: string
        }
        Insert: {
          id?: string
          lido_em?: string
          novidade_id: string
          user_id: string
        }
        Update: {
          id?: string
          lido_em?: string
          novidade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "novidades_leituras_novidade_id_fkey"
            columns: ["novidade_id"]
            isOneToOne: false
            referencedRelation: "novidades"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_status: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          dispensado: boolean
          iniciado_em: string
          passo: number
          updated_at: string
          user_id: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          dispensado?: boolean
          iniciado_em?: string
          passo?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          dispensado?: boolean
          iniciado_em?: string
          passo?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oportunidades: {
        Row: {
          campanha_id: string
          cliente_id: string | null
          created_at: string
          economia: number
          economia_pct: number
          especificador_id: string | null
          id: string
          itens_impactados: number
          loja_id: string | null
          orcamento_id: string
          status: Database["public"]["Enums"]["oportunidade_status"]
          tipo: Database["public"]["Enums"]["oportunidade_tipo"]
          updated_at: string
          valor_atual: number
          valor_original: number
          vendedor_id: string | null
        }
        Insert: {
          campanha_id: string
          cliente_id?: string | null
          created_at?: string
          economia?: number
          economia_pct?: number
          especificador_id?: string | null
          id?: string
          itens_impactados?: number
          loja_id?: string | null
          orcamento_id: string
          status?: Database["public"]["Enums"]["oportunidade_status"]
          tipo?: Database["public"]["Enums"]["oportunidade_tipo"]
          updated_at?: string
          valor_atual?: number
          valor_original?: number
          vendedor_id?: string | null
        }
        Update: {
          campanha_id?: string
          cliente_id?: string | null
          created_at?: string
          economia?: number
          economia_pct?: number
          especificador_id?: string | null
          id?: string
          itens_impactados?: number
          loja_id?: string | null
          orcamento_id?: string
          status?: Database["public"]["Enums"]["oportunidade_status"]
          tipo?: Database["public"]["Enums"]["oportunidade_tipo"]
          updated_at?: string
          valor_atual?: number
          valor_original?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oportunidades_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_cliente_fk"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_especificador_fk"
            columns: ["especificador_id"]
            isOneToOne: false
            referencedRelation: "especificadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_loja_fk"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oportunidades_vendedor_fk"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          categoria: string | null
          codigo_produto: string | null
          created_at: string
          descricao: string | null
          formato: string | null
          id: string
          linha: string | null
          orcamento_id: string
          produto_id: string | null
          quantidade: number
          tamanho: string | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          categoria?: string | null
          codigo_produto?: string | null
          created_at?: string
          descricao?: string | null
          formato?: string | null
          id?: string
          linha?: string | null
          orcamento_id: string
          produto_id?: string | null
          quantidade?: number
          tamanho?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Update: {
          categoria?: string | null
          codigo_produto?: string | null
          created_at?: string
          descricao?: string | null
          formato?: string | null
          id?: string
          linha?: string | null
          orcamento_id?: string
          produto_id?: string | null
          quantidade?: number
          tamanho?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_versoes: {
        Row: {
          arquivo: string | null
          campos_alterados: Json
          created_at: string
          id: string
          import_log_id: string | null
          observacao: string | null
          orcamento_id: string
          snapshot: Json | null
          status_anterior: string | null
          status_novo: string | null
          user_id: string | null
          valor_anterior: number | null
          valor_novo: number | null
        }
        Insert: {
          arquivo?: string | null
          campos_alterados?: Json
          created_at?: string
          id?: string
          import_log_id?: string | null
          observacao?: string | null
          orcamento_id: string
          snapshot?: Json | null
          status_anterior?: string | null
          status_novo?: string | null
          user_id?: string | null
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Update: {
          arquivo?: string | null
          campos_alterados?: Json
          created_at?: string
          id?: string
          import_log_id?: string | null
          observacao?: string | null
          orcamento_id?: string
          snapshot?: Json | null
          status_anterior?: string | null
          status_novo?: string | null
          user_id?: string | null
          valor_anterior?: number | null
          valor_novo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_versoes_import_log_id_fkey"
            columns: ["import_log_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_versoes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          categoria: string | null
          cliente_id: string | null
          codigo_produto: string | null
          created_at: string
          data_orcamento: string
          data_venda: string | null
          descricao_produto: string | null
          especificador_id: string | null
          formato: string | null
          id: string
          import_log_id: string | null
          linha_produto: string | null
          loja_id: string | null
          motivo_perda: Database["public"]["Enums"]["motivo_perda"] | null
          numero: string
          numero_pedido: string | null
          observacao: string | null
          status: Database["public"]["Enums"]["orcamento_status"]
          status_followup: Database["public"]["Enums"]["status_followup"] | null
          tamanho: string | null
          updated_at: string
          valor_orcado: number
          valor_vendido: number
          vendedor_id: string | null
        }
        Insert: {
          categoria?: string | null
          cliente_id?: string | null
          codigo_produto?: string | null
          created_at?: string
          data_orcamento: string
          data_venda?: string | null
          descricao_produto?: string | null
          especificador_id?: string | null
          formato?: string | null
          id?: string
          import_log_id?: string | null
          linha_produto?: string | null
          loja_id?: string | null
          motivo_perda?: Database["public"]["Enums"]["motivo_perda"] | null
          numero: string
          numero_pedido?: string | null
          observacao?: string | null
          status?: Database["public"]["Enums"]["orcamento_status"]
          status_followup?:
            | Database["public"]["Enums"]["status_followup"]
            | null
          tamanho?: string | null
          updated_at?: string
          valor_orcado?: number
          valor_vendido?: number
          vendedor_id?: string | null
        }
        Update: {
          categoria?: string | null
          cliente_id?: string | null
          codigo_produto?: string | null
          created_at?: string
          data_orcamento?: string
          data_venda?: string | null
          descricao_produto?: string | null
          especificador_id?: string | null
          formato?: string | null
          id?: string
          import_log_id?: string | null
          linha_produto?: string | null
          loja_id?: string | null
          motivo_perda?: Database["public"]["Enums"]["motivo_perda"] | null
          numero?: string
          numero_pedido?: string | null
          observacao?: string | null
          status?: Database["public"]["Enums"]["orcamento_status"]
          status_followup?:
            | Database["public"]["Enums"]["status_followup"]
            | null
          tamanho?: string | null
          updated_at?: string
          valor_orcado?: number
          valor_vendido?: number
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_especificador_id_fkey"
            columns: ["especificador_id"]
            isOneToOne: false
            referencedRelation: "especificadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_import_log_fk"
            columns: ["import_log_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos_staging: {
        Row: {
          canal: string | null
          categoria: string | null
          cliente: string | null
          codigo_produto: string | null
          created_at: string
          data_orcamento: string | null
          data_venda: string | null
          descricao_produto: string | null
          especificador: string | null
          formato: string | null
          id: number
          linha: number
          linha_produto: string | null
          log_id: string
          loja: string | null
          numero: string | null
          numero_pedido: string | null
          observacao: string | null
          status: string | null
          tamanho: string | null
          valor_orcado: number | null
          valor_vendido: number | null
          vendedor: string | null
        }
        Insert: {
          canal?: string | null
          categoria?: string | null
          cliente?: string | null
          codigo_produto?: string | null
          created_at?: string
          data_orcamento?: string | null
          data_venda?: string | null
          descricao_produto?: string | null
          especificador?: string | null
          formato?: string | null
          id?: number
          linha: number
          linha_produto?: string | null
          log_id: string
          loja?: string | null
          numero?: string | null
          numero_pedido?: string | null
          observacao?: string | null
          status?: string | null
          tamanho?: string | null
          valor_orcado?: number | null
          valor_vendido?: number | null
          vendedor?: string | null
        }
        Update: {
          canal?: string | null
          categoria?: string | null
          cliente?: string | null
          codigo_produto?: string | null
          created_at?: string
          data_orcamento?: string | null
          data_venda?: string | null
          descricao_produto?: string | null
          especificador?: string | null
          formato?: string | null
          id?: number
          linha?: number
          linha_produto?: string | null
          log_id?: string
          loja?: string | null
          numero?: string | null
          numero_pedido?: string | null
          observacao?: string | null
          status?: string | null
          tamanho?: string | null
          valor_orcado?: number | null
          valor_vendido?: number | null
          vendedor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_staging_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros: {
        Row: {
          chave: string
          created_at: string
          descricao: string | null
          grupo: string | null
          id: string
          updated_at: string
          valor: string
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string | null
          grupo?: string | null
          id?: string
          updated_at?: string
          valor: string
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string | null
          grupo?: string | null
          id?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          ativo: boolean
          categoria: string | null
          categoria_id: string | null
          created_at: string
          formato: string | null
          id: string
          linha: string | null
          nome: string
          preco: number | null
          sku: string
          tamanho: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          categoria_id?: string | null
          created_at?: string
          formato?: string | null
          id?: string
          linha?: string | null
          nome: string
          preco?: number | null
          sku: string
          tamanho?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          categoria_id?: string | null
          created_at?: string
          formato?: string | null
          id?: string
          linha?: string | null
          nome?: string
          preco?: number | null
          sku?: string
          tamanho?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          loja_id: string | null
          nome: string
          regiao_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id: string
          loja_id?: string | null
          nome: string
          regiao_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          loja_id?: string | null
          nome?: string
          regiao_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_regiao_id_fkey"
            columns: ["regiao_id"]
            isOneToOne: false
            referencedRelation: "regioes"
            referencedColumns: ["id"]
          },
        ]
      }
      regioes: {
        Row: {
          created_at: string
          id: string
          nome: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          cliente_id: string | null
          completed_at: string | null
          created_at: string
          descricao: string | null
          due_at: string
          especificador_id: string | null
          id: string
          loja_id: string | null
          orcamento_id: string | null
          owner_id: string | null
          status: Database["public"]["Enums"]["task_status"]
          tipo: Database["public"]["Enums"]["task_tipo"]
          titulo: string
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          completed_at?: string | null
          created_at?: string
          descricao?: string | null
          due_at: string
          especificador_id?: string | null
          id?: string
          loja_id?: string | null
          orcamento_id?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tipo?: Database["public"]["Enums"]["task_tipo"]
          titulo: string
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          completed_at?: string | null
          created_at?: string
          descricao?: string | null
          due_at?: string
          especificador_id?: string | null
          id?: string
          loja_id?: string | null
          orcamento_id?: string | null
          owner_id?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          tipo?: Database["public"]["Enums"]["task_tipo"]
          titulo?: string
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_especificador_id_fkey"
            columns: ["especificador_id"]
            isOneToOne: false
            referencedRelation: "especificadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias_especificador: {
        Row: {
          created_at: string
          data_transferencia: string
          especificador_id: string
          feedback: string | null
          id: string
          loja_destino_id: string | null
          loja_origem_id: string | null
          motivo: string
          observacao: string | null
          proxima_acao: string | null
          responsavel_id: string | null
          resultado: string | null
          updated_at: string
          vendedor_destino_id: string | null
          vendedor_origem_id: string | null
        }
        Insert: {
          created_at?: string
          data_transferencia?: string
          especificador_id: string
          feedback?: string | null
          id?: string
          loja_destino_id?: string | null
          loja_origem_id?: string | null
          motivo: string
          observacao?: string | null
          proxima_acao?: string | null
          responsavel_id?: string | null
          resultado?: string | null
          updated_at?: string
          vendedor_destino_id?: string | null
          vendedor_origem_id?: string | null
        }
        Update: {
          created_at?: string
          data_transferencia?: string
          especificador_id?: string
          feedback?: string | null
          id?: string
          loja_destino_id?: string | null
          loja_origem_id?: string | null
          motivo?: string
          observacao?: string | null
          proxima_acao?: string | null
          responsavel_id?: string | null
          resultado?: string | null
          updated_at?: string
          vendedor_destino_id?: string | null
          vendedor_origem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_especificador_especificador_id_fkey"
            columns: ["especificador_id"]
            isOneToOne: false
            referencedRelation: "especificadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_especificador_loja_destino_id_fkey"
            columns: ["loja_destino_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_especificador_loja_origem_id_fkey"
            columns: ["loja_origem_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_especificador_vendedor_destino_id_fkey"
            columns: ["vendedor_destino_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_especificador_vendedor_origem_id_fkey"
            columns: ["vendedor_origem_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      turnover_parametros: {
        Row: {
          alerta_carteira_nao_recuperada_pct: number
          alerta_queda_conversao_pp: number
          alerta_queda_sem_turnover_pct: number
          created_at: string
          id: string
          janela_comparacao_meses: number
          janela_loja_predominante_meses: number
          janela_vendedor_principal_meses: number
          meses_pausa: number
          recuperacao_parcial_max_pct: number
          recuperacao_parcial_min_pct: number
          sem_recuperacao_max_pct: number
          singleton: boolean
          tolerancia_recuperacao_total_pct: number
          updated_at: string
        }
        Insert: {
          alerta_carteira_nao_recuperada_pct?: number
          alerta_queda_conversao_pp?: number
          alerta_queda_sem_turnover_pct?: number
          created_at?: string
          id?: string
          janela_comparacao_meses?: number
          janela_loja_predominante_meses?: number
          janela_vendedor_principal_meses?: number
          meses_pausa?: number
          recuperacao_parcial_max_pct?: number
          recuperacao_parcial_min_pct?: number
          sem_recuperacao_max_pct?: number
          singleton?: boolean
          tolerancia_recuperacao_total_pct?: number
          updated_at?: string
        }
        Update: {
          alerta_carteira_nao_recuperada_pct?: number
          alerta_queda_conversao_pp?: number
          alerta_queda_sem_turnover_pct?: number
          created_at?: string
          id?: string
          janela_comparacao_meses?: number
          janela_loja_predominante_meses?: number
          janela_vendedor_principal_meses?: number
          meses_pausa?: number
          recuperacao_parcial_max_pct?: number
          recuperacao_parcial_min_pct?: number
          sem_recuperacao_max_pct?: number
          singleton?: boolean
          tolerancia_recuperacao_total_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendedor_status_log: {
        Row: {
          alterado_por: string | null
          created_at: string
          id: string
          loja_id: string | null
          motivo: string | null
          status_anterior: boolean | null
          status_novo: boolean
          vendedor_id: string
        }
        Insert: {
          alterado_por?: string | null
          created_at?: string
          id?: string
          loja_id?: string | null
          motivo?: string | null
          status_anterior?: boolean | null
          status_novo: boolean
          vendedor_id: string
        }
        Update: {
          alterado_por?: string | null
          created_at?: string
          id?: string
          loja_id?: string | null
          motivo?: string | null
          status_anterior?: boolean | null
          status_novo?: boolean
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_status_log_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendedor_status_log_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedores: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          loja_id: string | null
          matricula: string | null
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          loja_id?: string | null
          matricula?: string | null
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          loja_id?: string | null
          matricula?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendedores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_actions: {
        Row: {
          created_at: string
          id: string
          ordem: number
          params: Json
          tipo: Database["public"]["Enums"]["workflow_action_tipo"]
          workflow_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ordem?: number
          params?: Json
          tipo: Database["public"]["Enums"]["workflow_action_tipo"]
          workflow_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ordem?: number
          params?: Json
          tipo?: Database["public"]["Enums"]["workflow_action_tipo"]
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_actions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          acoes_resultado: Json | null
          executado_em: string
          executado_por: string | null
          gatilho: Database["public"]["Enums"]["workflow_trigger"]
          id: string
          observacao: string | null
          payload: Json | null
          status: Database["public"]["Enums"]["workflow_run_status"]
          workflow_id: string
        }
        Insert: {
          acoes_resultado?: Json | null
          executado_em?: string
          executado_por?: string | null
          gatilho: Database["public"]["Enums"]["workflow_trigger"]
          id?: string
          observacao?: string | null
          payload?: Json | null
          status: Database["public"]["Enums"]["workflow_run_status"]
          workflow_id: string
        }
        Update: {
          acoes_resultado?: Json | null
          executado_em?: string
          executado_por?: string | null
          gatilho?: Database["public"]["Enums"]["workflow_trigger"]
          id?: string
          observacao?: string | null
          payload?: Json | null
          status?: Database["public"]["Enums"]["workflow_run_status"]
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          ativo: boolean
          condicoes: Json
          created_at: string
          criado_por: string | null
          descricao: string | null
          dry_run: boolean
          gatilho: Database["public"]["Enums"]["workflow_trigger"]
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          condicoes?: Json
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          dry_run?: boolean
          gatilho: Database["public"]["Enums"]["workflow_trigger"]
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          condicoes?: Json
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          dry_run?: boolean
          gatilho?: Database["public"]["Enums"]["workflow_trigger"]
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      vendas_mensais: {
        Row: {
          loja_id: string | null
          mes: string | null
          qtd: number | null
          valor: number | null
          vendedor_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "vendedores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      carteira_alertas: {
        Args: { p_loja?: string }
        Returns: {
          mensagem: string
          severidade: string
          tipo: string
          valor: number
        }[]
      }
      carteira_alterar_status: {
        Args: { p_esp_ids: string[]; p_motivo?: string; p_status: string }
        Returns: number
      }
      carteira_distribuir: {
        Args: { p_esp_ids: string[]; p_motivo?: string; p_vendedor_id: string }
        Returns: number
      }
      carteira_esp_distribuicao_detalhe: {
        Args: { p_esp: string; p_fim?: string; p_inicio?: string }
        Returns: {
          loja_id: string
          loja_nome: string
          qtd_orcamentos: number
          ultima_venda: string
          ultimo_orcamento: string
          valor_orcado: number
          valor_vendido: number
          vendedor_id: string
          vendedor_nome: string
        }[]
      }
      carteira_esp_distribuicao_lojas: {
        Args: {
          p_fim?: string
          p_inicio?: string
          p_loja?: string
          p_vendedor?: string
        }
        Returns: {
          especificador_id: string
          loja_id: string
          loja_nome: string
          qtd_orcamentos: number
          ultimo_orcamento: string
          valor_orcado: number
          valor_vendido: number
        }[]
      }
      carteira_especificadores: {
        Args: {
          p_busca?: string
          p_fim?: string
          p_inicio?: string
          p_loja?: string
          p_status?: string
          p_vendedor?: string
        }
        Returns: {
          cidade: string
          conversao_pct: number
          dias_sem_contato: number
          id: string
          loja_id: string
          loja_nome: string
          nome: string
          qtd_orcamentos: number
          qtd_vendas: number
          status_carteira: string
          ticket_medio: number
          uf: string
          ultima_venda: string
          ultimo_orcamento: string
          valor_orcado: number
          valor_vendido: number
          vendedor_id: string
          vendedor_nome: string
        }[]
      }
      carteira_kpis: {
        Args: {
          p_fim?: string
          p_inicio?: string
          p_loja?: string
          p_vendedor?: string
        }
        Returns: {
          acompanhamento: number
          ativos: number
          compartilhados: number
          conversao_pct: number
          em_risco: number
          inativos: number
          sem_responsavel: number
          ticket_medio: number
          total: number
          valor_orcado: number
          valor_vendido: number
        }[]
      }
      carteira_por_loja: {
        Args: { p_fim?: string; p_inicio?: string }
        Returns: {
          canal: string
          conversao_pct: number
          loja_id: string
          loja_nome: string
          qtd_ativos: number
          qtd_especificadores: number
          qtd_inativos: number
          qtd_risco: number
          qtd_vendedores: number
          ticket_medio: number
          ultimo_contato: string
          valor_orcado: number
          valor_vendido: number
        }[]
      }
      carteira_por_vendedor: {
        Args: { p_fim?: string; p_inicio?: string; p_loja?: string }
        Returns: {
          conversao_pct: number
          loja_id: string
          loja_nome: string
          qtd_ativos: number
          qtd_especificadores: number
          qtd_inativos: number
          qtd_risco: number
          ticket_medio: number
          ultimo_contato: string
          valor_orcado: number
          valor_vendido: number
          vendedor_id: string
          vendedor_nome: string
        }[]
      }
      carteira_sem_responsavel: {
        Args: { p_loja?: string }
        Returns: {
          cidade: string
          dias_sem_contato: number
          id: string
          loja_id: string
          loja_nome: string
          nome: string
          qtd_orcamentos: number
          uf: string
          ultima_venda: string
          ultimo_orcamento: string
          valor_potencial: number
        }[]
      }
      carteira_transferir: {
        Args: {
          p_esp_ids?: string[]
          p_motivo?: string
          p_observacao?: string
          p_vendedor_destino: string
          p_vendedor_origem?: string
        }
        Returns: number
      }
      cron_gerar_alertas_especificadores: { Args: never; Returns: undefined }
      especificadores_conversao_analise: {
        Args: {
          p_fim: string
          p_inicio: string
          p_loja?: string
          p_tipo_mov?: string
        }
        Returns: {
          alerta_baixa_conversao: boolean
          classificacao: string
          conversao_qtd_pct: number
          conversao_valor_pct: number
          delta_valor_pct: number
          dias_sem_mov: number
          especificador_id: string
          loja_id: string
          loja_nome: string
          nome: string
          qtd_orcamentos: number
          qtd_vendas: number
          tempo_medio_orc_venda: number
          ticket_medio: number
          trocou_vendedor: boolean
          ultima_mov_data: string
          ultima_mov_tipo: string
          ultima_mov_valor: number
          valor_orcado: number
          valor_vendido: number
          vendedor_anterior_id: string
          vendedor_anterior_nome: string
          vendedor_atual_id: string
          vendedor_atual_nome: string
        }[]
      }
      especificadores_rankings: {
        Args: {
          p_fim: string
          p_inicio: string
          p_limite?: number
          p_loja?: string
          p_tipo?: string
        }
        Returns: {
          classificacao: string
          conversao_valor_pct: number
          delta_valor_pct: number
          dias_sem_mov: number
          especificador_id: string
          loja_nome: string
          nome: string
          posicao: number
          qtd_orcamentos: number
          qtd_vendas: number
          valor_orcado: number
          valor_vendido: number
        }[]
      }
      gerar_alertas_especificadores: {
        Args: { p_fim: string; p_inicio: string; p_loja?: string }
        Returns: number
      }
      gerar_followups_diarios: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      loja_vendedores_kpis: {
        Args: { p_fim?: string; p_inicio?: string; p_loja_id: string }
        Returns: {
          ativo: boolean
          carteira_qtd: number
          email: string
          nome: string
          ultima_movimentacao: string
          valor_orcado: number
          valor_vendido: number
          vendedor_id: string
        }[]
      }
      lojas_perfil_clientes: {
        Args: { p_fim: string; p_inicio: string; p_lojas: string[] }
        Returns: {
          clientes_recorrentes: number
          clientes_unicos: number
          dias_medio_ate_conversao: number
          distribuicao: Json
          loja_id: string
          loja_nome: string
          perfil_dominante: string
          recorrencia_pct: number
          ticket_mediano_cliente: number
          ticket_medio_cliente: number
        }[]
      }
      lojas_perfil_comparativo: {
        Args: { p_fim: string; p_inicio: string; p_lojas: string[] }
        Returns: {
          canal: string
          clientes_unicos: number
          conversao_qtd: number
          conversao_valor: number
          especificadores_ativos: number
          faixas: Json
          loja_id: string
          loja_nome: string
          qtd_orcamentos: number
          qtd_vendas: number
          ticket_medio_orcado: number
          ticket_medio_vendido: number
          valor_orcado: number
          valor_vendido: number
          vendedores_ativos: number
        }[]
      }
      lojas_perfil_especificadores: {
        Args: { p_fim: string; p_inicio: string; p_lojas: string[] }
        Returns: {
          conversao_esp_pct: number
          dependencia_top5_pct: number
          especificadores_ativos: number
          especificadores_recorrentes: number
          loja_id: string
          loja_nome: string
          ticket_medio_esp: number
          top_especificadores: Json
        }[]
      }
      lojas_perfil_evolucao: {
        Args: { p_fim: string; p_inicio: string; p_lojas: string[] }
        Returns: {
          loja_id: string
          loja_nome: string
          mes: string
          qtd_orcamentos: number
          qtd_vendas: number
          valor_orcado: number
          valor_vendido: number
        }[]
      }
      lojas_perfil_produtos: {
        Args: { p_fim: string; p_inicio: string; p_lojas: string[] }
        Returns: {
          cobertura_pct: number
          loja_id: string
          loja_nome: string
          top_categorias: Json
          top_formatos: Json
          top_linhas: Json
        }[]
      }
      lojas_perfil_vendedores: {
        Args: { p_fim: string; p_inicio: string; p_lojas: string[] }
        Returns: {
          conversao_media_pct: number
          dependencia_top3_pct: number
          loja_id: string
          loja_nome: string
          produtividade_media: number
          ticket_medio_vendedor: number
          top_vendedores: Json
          vendedores_ativos: number
        }[]
      }
      process_orcamentos_staging: { Args: { _log_id: string }; Returns: Json }
      process_orcamentos_staging_chunk: {
        Args: { _limit?: number; _log_id: string }
        Returns: Json
      }
      rastreabilidade_especificadores: {
        Args: { _ano_base: number; _ano_comp: number }
        Returns: {
          atual_in_base: boolean
          especificador_id: string
          loja_atual: string
          loja_origem: string
          lojas_base_count: number
          lojas_comp_count: number
          nome: string
          origem_in_comp: boolean
          valor_antes: number
          valor_base: number
          valor_comp: number
        }[]
      }
      recalcular_oportunidades_campanha: {
        Args: { _campanha_id: string }
        Returns: number
      }
      set_vendedor_ativo: {
        Args: { p_ativo: boolean; p_motivo?: string; p_vendedor_id: string }
        Returns: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          loja_id: string | null
          matricula: string | null
          nome: string
          telefone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "vendedores"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      turnover_especificador_vendedor_principal: {
        Args: { p_janela_meses: number; p_referencia: string }
        Returns: {
          especificador_id: string
          valor_total: number
          vendedor_id: string
        }[]
      }
      turnover_especificadores_migracao: {
        Args: { p_fim: string; p_inicio: string; p_loja?: string }
        Returns: {
          delta_pct: number
          especificador_id: string
          especificador_nome: string
          loja_atual_canal: string
          loja_atual_id: string
          loja_atual_nome: string
          loja_origem_canal: string
          loja_origem_id: string
          loja_origem_nome: string
          migrou: boolean
          mudou_canal: boolean
          trocou_vendedor: boolean
          valor_antes: number
          valor_depois: number
          vendedor_atual_id: string
          vendedor_atual_nome: string
          vendedor_origem_id: string
          vendedor_origem_nome: string
        }[]
      }
      turnover_eventos_carteira: {
        Args: { p_fim: string; p_inicio: string; p_loja?: string }
        Returns: {
          classificacao: string
          especificador_id: string
          especificador_nome: string
          evento_data: string
          loja_depois_id: string
          loja_depois_nome: string
          mesma_loja: boolean
          mesmo_vendedor: boolean
          orcado_antes: number
          orcado_depois: number
          status_vendedor: string
          valor_antes: number
          valor_depois: number
          vendedor_depois_id: string
          vendedor_depois_nome: string
          vendedor_id: string
          vendedor_nome: string
        }[]
      }
      turnover_grupo_controle: {
        Args: { p_fim: string; p_inicio: string; p_loja?: string }
        Returns: {
          delta_pct: number
          especificadores: number
          valor_antes: number
          valor_depois: number
          vendedores_ativos: number
        }[]
      }
      turnover_vendedores_resumo: {
        Args: { p_fim: string; p_inicio: string; p_loja?: string }
        Returns: {
          ativo: boolean
          carteira_especificadores: number
          conversao_pct: number
          evento_data: string
          loja_id: string
          loja_nome: string
          meses_inativo: number
          nome: string
          status: string
          total_orcado: number
          total_vendido: number
          ultima_atividade: string
          vendedor_id: string
        }[]
      }
      user_can_see_loja: {
        Args: { _loja_id: string; _user_id: string }
        Returns: boolean
      }
      user_is_global: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "assistente_venda"
        | "vendedor"
        | "coordenador_loja"
        | "gerente_loja"
        | "gerente_regional_franquia"
        | "head_nacional_loja_propria"
        | "head_nacional_franquia"
        | "analista_performance"
        | "gerente_performance"
        | "assistente"
        | "coordenador"
        | "gerente_regional"
        | "head_propria"
        | "head_franquia"
      campanha_status: "rascunho" | "ativa" | "encerrada"
      canal_tipo: "loja_propria" | "franquia" | "nao_classificado"
      carteira_mov_tipo: "distribuicao" | "status" | "inativacao" | "reativacao"
      carteira_status:
        | "ativo"
        | "acompanhamento"
        | "em_risco"
        | "inativo"
        | "sem_responsavel"
        | "compartilhado"
      escopo_gerente: "loja" | "regional" | "nacional"
      evento_tipo:
        | "evento"
        | "visita"
        | "almoco"
        | "treinamento"
        | "happy_hour"
        | "cafe"
        | "reuniao"
        | "outro"
      interacao_tipo:
        | "ligacao"
        | "whatsapp"
        | "email"
        | "visita"
        | "reuniao"
        | "evento"
        | "almoco"
        | "treinamento"
        | "outro"
      loja_tipo: "propria" | "franquia"
      motivo_perda:
        | "preco"
        | "prazo"
        | "concorrencia"
        | "desistencia"
        | "sem_estoque"
        | "outro"
      novidade_tipo:
        | "nova_funcionalidade"
        | "melhoria"
        | "correcao"
        | "nova_regra"
        | "novo_indicador"
      oportunidade_status: "nova" | "em_andamento" | "convertida" | "descartada"
      oportunidade_tipo: "reducao" | "aumento" | "desconto" | "promocional"
      orcamento_status:
        | "orcado"
        | "vendido"
        | "perdido"
        | "parcial"
        | "aberto"
        | "em_negociacao"
        | "aprovado"
        | "cancelado"
        | "reaberto"
        | "reaproveitado"
      status_followup:
        | "analisando"
        | "aguardando_aprovacao"
        | "comparando_concorrencia"
        | "sem_retorno"
        | "reagendar"
        | "em_negociacao"
        | "fechada"
        | "perdido"
      task_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      task_tipo:
        | "followup"
        | "ligacao"
        | "whatsapp"
        | "email"
        | "visita"
        | "aniversario"
        | "outro"
      workflow_action_tipo:
        | "criar_task"
        | "criar_interacao"
        | "notificar_usuario"
      workflow_run_status: "sucesso" | "erro" | "simulado"
      workflow_trigger:
        | "orcamento_criado"
        | "task_vencida"
        | "especificador_inativo"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "assistente_venda",
        "vendedor",
        "coordenador_loja",
        "gerente_loja",
        "gerente_regional_franquia",
        "head_nacional_loja_propria",
        "head_nacional_franquia",
        "analista_performance",
        "gerente_performance",
        "assistente",
        "coordenador",
        "gerente_regional",
        "head_propria",
        "head_franquia",
      ],
      campanha_status: ["rascunho", "ativa", "encerrada"],
      canal_tipo: ["loja_propria", "franquia", "nao_classificado"],
      carteira_mov_tipo: ["distribuicao", "status", "inativacao", "reativacao"],
      carteira_status: [
        "ativo",
        "acompanhamento",
        "em_risco",
        "inativo",
        "sem_responsavel",
        "compartilhado",
      ],
      escopo_gerente: ["loja", "regional", "nacional"],
      evento_tipo: [
        "evento",
        "visita",
        "almoco",
        "treinamento",
        "happy_hour",
        "cafe",
        "reuniao",
        "outro",
      ],
      interacao_tipo: [
        "ligacao",
        "whatsapp",
        "email",
        "visita",
        "reuniao",
        "evento",
        "almoco",
        "treinamento",
        "outro",
      ],
      loja_tipo: ["propria", "franquia"],
      motivo_perda: [
        "preco",
        "prazo",
        "concorrencia",
        "desistencia",
        "sem_estoque",
        "outro",
      ],
      novidade_tipo: [
        "nova_funcionalidade",
        "melhoria",
        "correcao",
        "nova_regra",
        "novo_indicador",
      ],
      oportunidade_status: ["nova", "em_andamento", "convertida", "descartada"],
      oportunidade_tipo: ["reducao", "aumento", "desconto", "promocional"],
      orcamento_status: [
        "orcado",
        "vendido",
        "perdido",
        "parcial",
        "aberto",
        "em_negociacao",
        "aprovado",
        "cancelado",
        "reaberto",
        "reaproveitado",
      ],
      status_followup: [
        "analisando",
        "aguardando_aprovacao",
        "comparando_concorrencia",
        "sem_retorno",
        "reagendar",
        "em_negociacao",
        "fechada",
        "perdido",
      ],
      task_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      task_tipo: [
        "followup",
        "ligacao",
        "whatsapp",
        "email",
        "visita",
        "aniversario",
        "outro",
      ],
      workflow_action_tipo: [
        "criar_task",
        "criar_interacao",
        "notificar_usuario",
      ],
      workflow_run_status: ["sucesso", "erro", "simulado"],
      workflow_trigger: [
        "orcamento_criado",
        "task_vencida",
        "especificador_inativo",
      ],
    },
  },
} as const
