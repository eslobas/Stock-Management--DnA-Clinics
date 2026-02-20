const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// CONFIGURAÇÃO DA BASE DE DADOS - CONFIRMA ESTES DADOS!
const dbConfig = {
    host: 'localhost',
    user: 'root',           // 👈 CONFIRMA QUE É 'root'
    password: '',           // 👈 SE TIVER PASSWORD, METE AQUI
    database: 'gestao_stock', // 👈 CONFIRMA QUE A BASE EXISTE
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

console.log('🔧 Configuração MySQL:', {
    ...dbConfig,
    password: dbConfig.password ? '******' : '(vazia)'
});

const pool = mysql.createPool(dbConfig);

// TESTAR CONEXÃO AO INICIAR
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL conectado com sucesso!');
       
        // Verificar se a tabela existe
        const [tables] = await connection.query('SHOW TABLES LIKE "produtos"');
        if (tables.length === 0) {
            console.log('❌ Tabela "produtos" não existe!');
            console.log('📌 Cria a tabela com:');
            console.log(`
                CREATE TABLE produtos (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    nome VARCHAR(100) NOT NULL,
                    quantidade INT NOT NULL DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                );
            `);
        } else {
            console.log('✅ Tabela "produtos" existe');
           
            // Contar produtos
            const [count] = await connection.query('SELECT COUNT(*) as total FROM produtos');
            console.log(`📊 Total de produtos na base: ${count[0].total}`);
        }
       
        connection.release();
    } catch (err) {
        console.error('❌ ERRO CRÍTICO AO CONECTAR AO MYSQL:');
        console.error(err.message);
        console.log('\n📌 POSSÍVEIS CAUSAS:');
        console.log('1. MySQL não está a correr (services.msc)');
        console.log('2. Password do root está errada');
        console.log('3. Base de dados "gestao_stock" não existe');
        console.log('4. Utilizador "root" não tem permissões');
    }
})();

// ========== ENDPOINTS ==========

// GET todos os produtos (COM DEBUG)
app.get('/api/produtos', async (req, res) => {
    console.log('📥 GET /api/produtos - a processar...');
   
    try {
        const [rows] = await pool.query('SELECT * FROM produtos ORDER BY nome');
        console.log(`📤 Enviando ${rows.length} produtos`);
        res.json(rows);
    } catch (err) {
        console.error('❌ ERRO NO GET PRODUTOS:', err.message);
        console.error('Stack:', err.stack);
        res.status(500).json({
            error: 'Erro ao buscar produtos',
            detalhe: err.message,
            sql: err.sql || null
        });
    }
});

// GET busca por nome
app.get('/api/produtos/busca/:termo', async (req, res) => {
    try {
        const termo = `%${req.params.termo}%`;
        const [rows] = await pool.query(
            'SELECT * FROM produtos WHERE nome LIKE ? ORDER BY nome',
            [termo]
        );
        res.json(rows);
    } catch (err) {
        console.error('Erro na busca:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST novo produto
app.post('/api/produtos', async (req, res) => {
    try {
        const { nome, quantidade } = req.body;
       
        const [result] = await pool.query(
            'INSERT INTO produtos (nome, quantidade) VALUES (?, ?)',
            [nome, quantidade]
        );
       
        res.json({
            id: result.insertId,
            nome,
            quantidade
        });
    } catch (err) {
        console.error('Erro ao adicionar produto:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT atualizar produto
app.put('/api/produtos/:id', async (req, res) => {
    try {
        const { nome, quantidade } = req.body;
       
        await pool.query(
            'UPDATE produtos SET nome = ?, quantidade = ? WHERE id = ?',
            [nome, quantidade, req.params.id]
        );
       
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao atualizar produto:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH atualizar quantidade
app.patch('/api/produtos/:id/quantidade', async (req, res) => {
    try {
        const { quantidade } = req.body;
       
        await pool.query(
            'UPDATE produtos SET quantidade = ? WHERE id = ?',
            [quantidade, req.params.id]
        );
       
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao atualizar quantidade:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE produto
app.delete('/api/produtos/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM produtos WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao eliminar produto:', err);
        res.status(500).json({ error: err.message });
    }
});

// Servir frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor a correr em http://localhost:${PORT}`);
    console.log(`📌 Para testar: http://localhost:${PORT}/api/produtos`);
});