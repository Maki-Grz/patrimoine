<script>
  import { appState } from '../lib/state.svelte.js';
  import { i18n } from '../lib/i18n.svelte.js';

  // Drag & drop logic states
  let activeDragNode = $state(null);
  let dragOffset = { x: 0, y: 0 };

  // Form states and Dialog references
  let nodeDialogRef = $state(null);
  let connectionDialogRef = $state(null);
  let nodesListDialogRef = $state(null);
  let connectionsListDialogRef = $state(null);

  let nodeForm = $state({ Label: '', Type: 'Transit', Account_ID: '' });
  let connectionForm = $state({ SourceNode_ID: '', TargetNode_ID: '', TypeRegle: 'PERCENT', Valeur: 0 });

  // Drag & drop handlers
  function handleMouseDown(e, node) {
    activeDragNode = node;
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function handleMouseMove(e) {
    if (activeDragNode) {
      const container = document.getElementById('flow-graph-container');
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const x = Math.round(e.clientX - containerRect.left - dragOffset.x);
      const y = Math.round(e.clientY - containerRect.top - dragOffset.y);
      activeDragNode.PosX = Math.max(10, Math.min(680, x));
      activeDragNode.PosY = Math.max(10, Math.min(480, y));
    }
  }

  async function handleMouseUp() {
    if (activeDragNode) {
      const nodeToSave = activeDragNode;
      activeDragNode = null;
      try {
        await fetch(`/odata/v4/patrimoine/FlowNodes(${nodeToSave.ID})`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ PosX: nodeToSave.PosX, PosY: nodeToSave.PosY })
        });
      } catch (err) {
        console.error("Erreur de sauvegarde de position:", err);
      }
    }
  }

  // Client-side DAG simulator to preview split
  function simulateGraphSplit(salaryAmount) {
    if (!appState.flowNodes || appState.flowNodes.length === 0 || 
        !appState.flowConnections || appState.flowConnections.length === 0 || 
        !salaryAmount || salaryAmount <= 0) return [];
    
    const nodesMap = new Map(appState.flowNodes.map(n => [n.ID, { ...n }]));
    const outgoing = new Map(appState.flowNodes.map(n => [n.ID, []]));
    const inDegrees = {};
    
    for (const node of appState.flowNodes) {
      inDegrees[node.ID] = 0;
    }
    for (const conn of appState.flowConnections) {
      if (outgoing.has(conn.SourceNode_ID)) {
        outgoing.get(conn.SourceNode_ID).push(conn);
      }
      inDegrees[conn.TargetNode_ID] = (inDegrees[conn.TargetNode_ID] || 0) + 1;
    }

    const incomingBalances = {};
    for (const node of appState.flowNodes) {
      incomingBalances[node.ID] = 0;
    }

    const queue = [];
    for (const node of appState.flowNodes) {
      if (inDegrees[node.ID] === 0 || node.Type === 'Source') {
        queue.push(node.ID);
      }
    }

    const sourceNodes = appState.flowNodes.filter(n => n.Type === 'Source');
    if (sourceNodes.length > 0) {
      incomingBalances[sourceNodes[0].ID] = salaryAmount;
    } else if (queue.length > 0) {
      incomingBalances[queue[0]] = salaryAmount;
    }

    const allocations = [];
    const visited = {};

    while (queue.length > 0) {
      const currId = queue.shift();
      visited[currId] = (visited[currId] || 0) + 1;
      if (visited[currId] > 30) continue;

      const currNode = nodesMap.get(currId);
      const currAmount = incomingBalances[currId];
      if (!currNode || currAmount <= 0) continue;

      const conns = outgoing.get(currId) || [];
      if (conns.length === 0) continue;

      const fixedConns = conns.filter(c => c.TypeRegle === 'FIXED');
      const percentConns = conns.filter(c => c.TypeRegle === 'PERCENT');

      let remaining = currAmount;

      for (const conn of fixedConns) {
        const val = parseFloat(conn.Valeur || 0);
        const allocated = Math.round(Math.min(remaining, val) * 100) / 100;
        if (allocated > 0) {
          remaining -= allocated;
          incomingBalances[conn.TargetNode_ID] += allocated;
          const targetNode = nodesMap.get(conn.TargetNode_ID);
          allocations.push({
            sourceLabel: currNode.Label,
            targetLabel: targetNode ? targetNode.Label : 'Inconnu',
            amount: allocated,
            type: 'FIXED',
            valeur: val
          });
        }
        inDegrees[conn.TargetNode_ID]--;
        if (inDegrees[conn.TargetNode_ID] <= 0 && !queue.includes(conn.TargetNode_ID)) {
          queue.push(conn.TargetNode_ID);
        }
      }

      const totalPercentSource = currAmount;
      for (const conn of percentConns) {
        const percent = parseFloat(conn.Valeur || 0);
        const val = totalPercentSource * (percent / 100);
        const allocated = Math.round(Math.min(remaining, val) * 100) / 100;
        if (allocated > 0) {
          remaining -= allocated;
          incomingBalances[conn.TargetNode_ID] += allocated;
          const targetNode = nodesMap.get(conn.TargetNode_ID);
          allocations.push({
            sourceLabel: currNode.Label,
            targetLabel: targetNode ? targetNode.Label : 'Inconnu',
            amount: allocated,
            type: 'PERCENT',
            valeur: percent
          });
        }
        inDegrees[conn.TargetNode_ID]--;
        if (inDegrees[conn.TargetNode_ID] <= 0 && !queue.includes(conn.TargetNode_ID)) {
          queue.push(conn.TargetNode_ID);
        }
      }
    }

    return allocations;
  }

  // Real-time flow node previews
  let graphPreviewAllocations = $derived.by(() => {
    if (appState.currentSalaryAmount <= 0) return {};
    const allocs = simulateGraphSplit(appState.currentSalaryAmount);
    const sums = {};
    const sourceNode = appState.flowNodes.find(n => n.Type === 'Source');
    if (sourceNode) {
      sums[sourceNode.ID] = appState.currentSalaryAmount;
    }
    allocs.forEach(alloc => {
      const tgtNode = appState.flowNodes.find(n => n.Label === alloc.targetLabel);
      if (tgtNode) {
        sums[tgtNode.ID] = (sums[tgtNode.ID] || 0) + alloc.amount;
      }
    });
    return sums;
  });

  // Dialog management functions
  function openManageNodes() {
    if (nodesListDialogRef) {
      nodesListDialogRef.open = true;
      if (typeof nodesListDialogRef.show === 'function') nodesListDialogRef.show();
    }
  }

  function openManageConnections() {
    if (connectionsListDialogRef) {
      connectionsListDialogRef.open = true;
      if (typeof connectionsListDialogRef.show === 'function') connectionsListDialogRef.show();
    }
  }

  function openAddNode() {
    nodeForm = { Label: '', Type: 'Transit', Account_ID: '' };
    if (nodeDialogRef) {
      nodeDialogRef.open = true;
      if (typeof nodeDialogRef.show === 'function') nodeDialogRef.show();
    }
  }

  async function saveNode() {
    appState.loading = true;
    try {
      const posX = 100 + Math.floor(Math.random() * 200);
      const posY = 100 + Math.floor(Math.random() * 200);
      
      const payload = {
        Label: nodeForm.Label || 'Nouveau Nœud',
        Type: nodeForm.Type,
        Account_ID: nodeForm.Account_ID ? nodeForm.Account_ID : null,
        PosX: posX,
        PosY: posY
      };

      const res = await fetch('/odata/v4/patrimoine/FlowNodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        appState.showToast("Nœud créé avec succès !");
        if (nodeDialogRef) {
          nodeDialogRef.open = false;
          if (typeof nodeDialogRef.close === 'function') nodeDialogRef.close();
        }
        await appState.loadData();
      } else {
        appState.showToast("Erreur lors de la création du nœud.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      appState.loading = false;
    }
  }

  async function deleteNode(id) {
    if (!confirm("Voulez-vous supprimer ce nœud ? Ses liaisons associées seront également supprimées.")) return;
    appState.loading = true;
    try {
      const connectedConns = appState.flowConnections.filter(c => c.SourceNode_ID === id || c.TargetNode_ID === id);
      for (const conn of connectedConns) {
        await fetch(`/odata/v4/patrimoine/FlowConnections(${conn.ID})`, { method: 'DELETE' });
      }

      const res = await fetch(`/odata/v4/patrimoine/FlowNodes(${id})`, { method: 'DELETE' });
      if (res.ok) {
        appState.showToast("Nœud supprimé.");
        await appState.loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      appState.loading = false;
    }
  }

  function openAddConnection() {
    connectionForm = { SourceNode_ID: '', TargetNode_ID: '', TypeRegle: 'PERCENT', Valeur: 0 };
    if (connectionDialogRef) {
      connectionDialogRef.open = true;
      if (typeof connectionDialogRef.show === 'function') connectionDialogRef.show();
    }
  }

  async function saveConnection() {
    if (!connectionForm.SourceNode_ID || !connectionForm.TargetNode_ID) {
      appState.showToast("Veuillez sélectionner un nœud source et cible.");
      return;
    }
    if (connectionForm.SourceNode_ID === connectionForm.TargetNode_ID) {
      appState.showToast("Le nœud source et cible ne peuvent pas être identiques.");
      return;
    }
    appState.loading = true;
    try {
      const payload = {
        SourceNode_ID: connectionForm.SourceNode_ID,
        TargetNode_ID: connectionForm.TargetNode_ID,
        TypeRegle: connectionForm.TypeRegle,
        Valeur: parseFloat(connectionForm.Valeur || 0)
      };

      const res = await fetch('/odata/v4/patrimoine/FlowConnections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        appState.showToast("Liaison créée avec succès !");
        if (connectionDialogRef) {
          connectionDialogRef.open = false;
          if (typeof connectionDialogRef.close === 'function') connectionDialogRef.close();
        }
        await appState.loadData();
      } else {
        appState.showToast("Erreur lors de la création de la liaison.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      appState.loading = false;
    }
  }

  async function deleteConnection(id) {
    if (!confirm("Voulez-vous supprimer cette liaison ?")) return;
    appState.loading = true;
    try {
      const res = await fetch(`/odata/v4/patrimoine/FlowConnections(${id})`, { method: 'DELETE' });
      if (res.ok) {
        appState.showToast("Liaison supprimée.");
        await appState.loadData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      appState.loading = false;
    }
  }
</script>

<div class="page-title-container">
  <h1 class="page-title">{i18n.t('graph.visualTitle')}</h1>
</div>

<div class="sap-card" style="height: calc(100vh - 180px); min-height: 600px; display: flex; flex-direction: column;">
  <div class="sap-card-header" style="position: relative;">
    <div>
      <span class="sap-card-title">Visualisation interactive (style n8n)</span>
      <span style="font-size: 11px; color: var(--sap-text-muted-color); display: block; margin-top: 4px;">
        Glissez les boîtes pour réorganiser. Utilisez les boutons de gestion pour modifier la structure.
      </span>
    </div>
    
    <!-- Actions in top-right corner of card header -->
    <div style="display: flex; gap: 8px;">
      <ui5-button icon="add" design="Emphasized" onclick={openAddNode}>Nouveau Nœud</ui5-button>
      <ui5-button icon="org-chart" design="Emphasized" onclick={openAddConnection}>Nouvelle Liaison</ui5-button>
      <ui5-button icon="list" onclick={openManageNodes}>{i18n.t('graph.btnNodes')}</ui5-button>
      <ui5-button icon="settings" onclick={openManageConnections}>{i18n.currentLang === 'fr' ? 'Gérer les Liaisons' : 'Manage Connections'}</ui5-button>
    </div>
  </div>
  <div class="sap-card-body" style="padding: 0; flex: 1; position: relative; overflow: auto; background-color: #fafbfc;">
    <div class="flow-graph-container" id="flow-graph-container" style="width: 100%; height: 100%; min-width: 960px; min-height: 540px; position: relative; margin-top: 0; border: none; border-radius: 0;" onmousemove={handleMouseMove} onmouseup={handleMouseUp}>
      <svg style="position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none;">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--sap-primary-color)" />
          </marker>
        </defs>
        {#each appState.flowConnections as conn}
          {@const sourceNode = appState.flowNodes.find(n => n.ID === conn.SourceNode_ID)}
          {@const targetNode = appState.flowNodes.find(n => n.ID === conn.TargetNode_ID)}
          {#if sourceNode && targetNode}
            {@const x1 = sourceNode.PosX + 170}
            {@const y1 = sourceNode.PosY + 40}
            {@const x2 = targetNode.PosX}
            {@const y2 = targetNode.PosY + 40}
            {@const dx = Math.abs(x2 - x1) / 2}
            <path 
              d="M {x1} {y1} C {x1 + dx} {y1}, {x2 - dx} {y2}, {x2} {y2}" 
              stroke="var(--sap-primary-color)" 
              stroke-width="2" 
              fill="none" 
              marker-end="url(#arrow)" />
          {/if}
        {/each}
      </svg>

      {#each appState.flowNodes as node}
        <div 
          class="flow-node" 
          style="left: {node.PosX}px; top: {node.PosY}px;"
          onmousedown={(e) => handleMouseDown(e, node)}>
          
          <button 
            class="flow-node-delete-btn" 
            onclick={(e) => { e.stopPropagation(); deleteNode(node.ID); }}
            title="Supprimer le nœud">
            ×
          </button>

          <div class="flow-node-title">{node.Label}</div>
          <div class="flow-node-badge">{node.Type}</div>
          {#if node.Account}
            <div class="flow-node-solde">{appState.formatCurrency(node.Account.SoldeActuel)}</div>
          {/if}
          {#if appState.nodeAllocatedAmounts[node.ID]}
            <div style="color: var(--sap-success-color); font-weight: bold; font-size: 12px; margin-top: 4px;">
              + {appState.formatCurrency(appState.nodeAllocatedAmounts[node.ID])}
            </div>
          {:else}
            {@const previewAmount = graphPreviewAllocations[node.ID]}
            {#if previewAmount > 0}
              <div style="color: var(--sap-information-color); font-weight: bold; font-size: 11px; margin-top: 4px; opacity: 0.8;" title="Flux simulé en temps réel (saisie actuelle)">
                + {appState.formatCurrency(previewAmount)}
              </div>
            {/if}
          {/if}
        </div>
      {/each}

      {#each appState.flowConnections as conn}
        {@const sourceNode = appState.flowNodes.find(n => n.ID === conn.SourceNode_ID)}
        {@const targetNode = appState.flowNodes.find(n => n.ID === conn.TargetNode_ID)}
        {#if sourceNode && targetNode}
          {@const x1 = sourceNode.PosX + 170}
          {@const y1 = sourceNode.PosY + 40}
          {@const x2 = targetNode.PosX}
          {@const y2 = targetNode.PosY + 40}
          {@const labelX = (x1 + x2) / 2}
          {@const labelY = (y1 + y2) / 2}
          <div class="flow-edge-label" style="left: {labelX}px; top: {labelY}px;">
            <span>{conn.TypeRegle === 'PERCENT' ? `${conn.Valeur}%` : `${conn.Valeur} €`}</span>
            <button 
              class="flow-edge-delete-btn" 
              onclick={(e) => { e.stopPropagation(); deleteConnection(conn.ID); }}
              title="Supprimer la liaison">
              ×
            </button>
          </div>
        {/if}
      {/each}
    </div>
  </div>
</div>

<!-- ADD NODE DIALOG -->
<ui5-dialog bind:this={nodeDialogRef} header-text="Ajouter un Nœud de Flux">
  <div style="padding: 16px; width: 340px; display: flex; flex-direction: column; gap: 16px;">
    <div class="form-group">
      <label for="node-label">Nom du nœud</label>
      <ui5-input 
        id="node-label" 
        value={nodeForm.Label}
        oninput={(e) => nodeForm.Label = e.target.value}>
      </ui5-input>
    </div>

    <div class="form-group">
      <label for="node-type">Type de Nœud</label>
      <ui5-select id="node-type" value={nodeForm.Type} onchange={(e) => nodeForm.Type = e.target.value}>
        <ui5-option selected={nodeForm.Type === 'Transit' ? true : undefined} value="Transit">Compte / Transit</ui5-option>
        <ui5-option selected={nodeForm.Type === 'Source' ? true : undefined} value="Source">Source (Entrée)</ui5-option>
        <ui5-option selected={nodeForm.Type === 'Target' ? true : undefined} value="Target">Cible (Épargne/Bloqué)</ui5-option>
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="node-account">Compte physique associé (optionnel)</label>
      <ui5-select id="node-account" value={nodeForm.Account_ID} onchange={(e) => nodeForm.Account_ID = e.target.value}>
        <ui5-option selected={!nodeForm.Account_ID ? true : undefined} value="">-- Aucun --</ui5-option>
        {#each appState.accounts as acc}
          <ui5-option selected={nodeForm.Account_ID === acc.ID ? true : undefined} value={acc.ID}>
            {acc.Libelle}
          </ui5-option>
        {/each}
      </ui5-select>
    </div>
  </div>
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => {
      nodeDialogRef.open = false;
      if (typeof nodeDialogRef.close === 'function') nodeDialogRef.close();
    }} design="Transparent">Annuler</ui5-button>
    <ui5-button onclick={saveNode} design="Emphasized">Enregistrer</ui5-button>
  </div>
</ui5-dialog>

<!-- ADD CONNECTION DIALOG -->
<ui5-dialog bind:this={connectionDialogRef} header-text="Ajouter une Liaison de Flux">
  <div style="padding: 16px; width: 340px; display: flex; flex-direction: column; gap: 16px;">
    <div class="form-group">
      <label for="conn-source">Nœud Source</label>
      <ui5-select id="conn-source" value={connectionForm.SourceNode_ID} onchange={(e) => connectionForm.SourceNode_ID = e.target.value}>
        <ui5-option selected={!connectionForm.SourceNode_ID ? true : undefined} value="">-- Sélectionner --</ui5-option>
        {#each appState.flowNodes as n}
          <ui5-option selected={connectionForm.SourceNode_ID === n.ID ? true : undefined} value={n.ID}>
            {n.Label}
          </ui5-option>
        {/each}
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="conn-target">Nœud Cible</label>
      <ui5-select id="conn-target" value={connectionForm.TargetNode_ID} onchange={(e) => connectionForm.TargetNode_ID = e.target.value}>
        <ui5-option selected={!connectionForm.TargetNode_ID ? true : undefined} value="">-- Sélectionner --</ui5-option>
        {#each appState.flowNodes as n}
          <ui5-option selected={connectionForm.TargetNode_ID === n.ID ? true : undefined} value={n.ID}>
            {n.Label}
          </ui5-option>
        {/each}
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="conn-type">{i18n.currentLang === 'fr' ? 'Type de règle' : 'Rule Type'}</label>
      <ui5-select id="conn-type" value={connectionForm.TypeRegle} onchange={(e) => connectionForm.TypeRegle = e.target.value}>
        <ui5-option selected={connectionForm.TypeRegle === 'PERCENT' ? true : undefined} value="PERCENT">Pourcentage (%)</ui5-option>
        <ui5-option selected={connectionForm.TypeRegle === 'FIXED' ? true : undefined} value="FIXED">Montant Fixe (€)</ui5-option>
      </ui5-select>
    </div>

    <div class="form-group">
      <label for="conn-value">Valeur ({connectionForm.TypeRegle === 'PERCENT' ? '%' : '€'})</label>
      <ui5-input 
        id="conn-value" 
        type="Number" 
        value={connectionForm.Valeur}
        oninput={(e) => connectionForm.Valeur = parseFloat(e.target.value || 0)}>
      </ui5-input>
    </div>
  </div>
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => {
      connectionDialogRef.open = false;
      if (typeof connectionDialogRef.close === 'function') connectionDialogRef.close();
    }} design="Transparent">Annuler</ui5-button>
    <ui5-button onclick={saveConnection} design="Emphasized">Enregistrer</ui5-button>
  </div>
</ui5-dialog>

<!-- MANAGE NODES DIALOG -->
<ui5-dialog bind:this={nodesListDialogRef} header-text="{i18n.currentLang === 'fr' ? 'Gérer les Nœuds' : 'Manage Nodes'} du Graphe">
  <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; width: 420px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 13px; color: var(--sap-text-muted-color);">Nœuds configurés :</span>
      <ui5-button icon="add" onclick={openAddNode} design="Emphasized">Ajouter un Nœud</ui5-button>
    </div>
    <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--sap-border-light-color); border-radius: 4px;">
      <table class="sap-table" style="font-size: 12px; width: 100%;">
        <thead>
          <tr>
            <th>Libellé</th>
            <th>Type</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          {#each appState.flowNodes as node}
            <tr>
              <td style="font-weight: bold;">{node.Label}</td>
              <td>
                <span class="badge" style="background-color: var(--sap-background-color);">
                  {node.Type === 'Source' ? 'Source' : node.Type === 'Target' ? 'Cible' : 'Transit'}
                </span>
              </td>
              <td style="text-align: right;">
                <ui5-button icon="delete" design="Transparent" onclick={() => deleteNode(node.ID)}></ui5-button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => {
      nodesListDialogRef.open = false;
      if (typeof nodesListDialogRef.close === 'function') nodesListDialogRef.close();
    }} design="Emphasized">Fermer</ui5-button>
  </div>
</ui5-dialog>

<!-- MANAGE CONNECTIONS DIALOG -->
<ui5-dialog bind:this={connectionsListDialogRef} header-text="Gérer les Liaisons de Flux">
  <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; width: 420px;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="font-size: 13px; color: var(--sap-text-muted-color);">Liaisons actives :</span>
      <ui5-button icon="add" onclick={openAddConnection} design="Emphasized">Créer une Liaison</ui5-button>
    </div>
    <div style="max-height: 300px; overflow-y: auto; border: 1px solid var(--sap-border-light-color); border-radius: 4px;">
      <table class="sap-table" style="font-size: 12px; width: 100%;">
        <thead>
          <tr>
            <th>Source ➔ Cible</th>
            <th>Valeur</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          {#each appState.flowConnections as conn}
            {@const src = appState.flowNodes.find(n => n.ID === conn.SourceNode_ID)}
            {@const tgt = appState.flowNodes.find(n => n.ID === conn.TargetNode_ID)}
            <tr>
              <td>
                <div style="font-weight: 600;">{src ? src.Label : 'Inconnu'}</div>
                <div style="font-size: 10px; color: var(--sap-text-muted-color);">➔ {tgt ? tgt.Label : 'Inconnu'}</div>
              </td>
              <td style="font-weight: bold; color: var(--sap-primary-color);">
                {conn.TypeRegle === 'PERCENT' ? `${conn.Valeur}%` : `${conn.Valeur} €`}
              </td>
              <td style="text-align: right;">
                <ui5-button icon="delete" design="Transparent" onclick={() => deleteConnection(conn.ID)}></ui5-button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
  <div slot="footer" class="form-actions" style="width: 100%; padding: 8px 16px;">
    <ui5-button onclick={() => {
      connectionsListDialogRef.open = false;
      if (typeof connectionsListDialogRef.close === 'function') connectionsListDialogRef.close();
    }} design="Emphasized">Fermer</ui5-button>
  </div>
</ui5-dialog>
