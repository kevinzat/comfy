import React from 'react';
import { DeclsAst } from '../lang/decls_ast';
import { TheoremAst } from '../lang/theorem_ast';
import ProofSetup from './ProofSetup';
import Proof from './Proof';


interface AppState {
  problem: { decls: DeclsAst; theorem: TheoremAst } | null;
}

export default class App extends React.Component<{}, AppState> {
  constructor(props: {}) {
    super(props);
    this.state = { problem: null };
  }

  render() {
    if (this.state.problem === null) {
      return <ProofSetup
          onStart={(decls, theorem) =>
            this.setState({ problem: { decls, theorem } })} />;
    } else {
      return <Proof decls={this.state.problem.decls}
          theorem={this.state.problem.theorem} />;
    }
  }
}
